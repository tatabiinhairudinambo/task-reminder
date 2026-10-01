import { prisma } from '@/lib/db';
import { ApiError } from '@/lib/api-response';
import { num, decimal2 } from '@/lib/serialize';
import { serializeCourseContent } from '@/lib/serialize';
import { siakangCredentialsOf } from '@/lib/services/settings-service';
import { getGrades } from '@/lib/services/siakang-client';

// Port of App\Services\AssessmentService.

export async function calculateGpa(userId, selectedSemester) {
  const [grades, all] = await Promise.all([
    prisma.grade.findMany({ where: { user_id: userId } }),
    prisma.courseContent.findMany({
      where: { user_id: userId },
      orderBy: { course_content: 'asc' },
    }),
  ]);

  // Unique semesters in insertion order, matching Laravel's pluck()->unique().
  const semesters = [...new Set(all.map((c) => c.semester))];

  const mapGrade = (content) => {
    const score = content.score === null ? null : Number(content.score);

    const grade =
      score === null
        ? null
        : grades.find(
            (g) => score >= Number(g.minimal_score) && score <= Number(g.maximal_score)
          ) ?? null;

    return {
      id: num(content.id),
      course_content: content.course_content,
      lecturer: content.lecturer,
      // Laravel used number_format(..., 2).
      score: score === null ? null : score.toFixed(2),
      credits: num(content.credits),
      grade: grade?.grade ?? null,
      grade_point: grade ? Number(grade.grade_point) : 0,
    };
  };

  const grouped = new Map();
  for (const content of all) {
    const list = grouped.get(content.semester) ?? [];
    list.push(content);
    grouped.set(content.semester, list);
  }

  let totalWeightedAll = 0;
  let totalCreditsAll = 0;
  const gpaPerSemester = {};

  for (const [semester, contents] of grouped) {
    const mapped = contents.map(mapGrade);
    const hasEmpty = mapped.some((c) => c.score === null);

    if (!hasEmpty && mapped.length > 0) {
      const weighted = mapped.reduce((sum, c) => sum + c.grade_point * c.credits, 0);
      const totalCredits = mapped.reduce((sum, c) => sum + c.credits, 0);
      const semesterGpa = totalCredits > 0 ? weighted / totalCredits : 0;

      gpaPerSemester[semester] = semesterGpa.toFixed(2);
      totalWeightedAll += weighted;
      totalCreditsAll += totalCredits;
    } else {
      gpaPerSemester[semester] = '0.00';
    }
  }

  const cumulativeGpa = totalCreditsAll > 0 ? totalWeightedAll / totalCreditsAll : 0;

  // Default to the last semester, matching `$semesters->last()`.
  const target = selectedSemester ?? semesters[semesters.length - 1];
  const selectedContents = (grouped.get(target) ?? []).map(mapGrade);

  const hasEmptySelected = selectedContents.some((c) => c.score === null);
  let selectedGpa = '0.00';

  if (!hasEmptySelected && selectedContents.length > 0) {
    const weighted = selectedContents.reduce((sum, c) => sum + c.grade_point * c.credits, 0);
    const totalCredits = selectedContents.reduce((sum, c) => sum + c.credits, 0);
    selectedGpa = totalCredits > 0 ? (weighted / totalCredits).toFixed(2) : '0.00';
  }

  return {
    semester_gpa: selectedGpa,
    cumulative_gpa: cumulativeGpa.toFixed(2),
    gpa_per_semester: gpaPerSemester,
    course_contents: selectedContents,
  };
}

/** Set or clear a score. `null` explicitly clears it. */
export async function updateScore(userId, id, score) {
  const existing = await prisma.courseContent.findFirst({
    where: { id: BigInt(id), user_id: userId },
  });

  if (!existing) {
    throw new ApiError('No query results for model [App\\Models\\CourseContent] '.concat(id), 404);
  }

  const updated = await prisma.courseContent.update({
    where: { id: existing.id },
    data: { score: score === null || score === undefined ? null : score },
  });

  return serializeCourseContent(updated);
}

/**
 * Pull scores from Siakang and match them onto local course names.
 * Three-tier matching mirrors the Laravel implementation exactly:
 *   1. exact name (case-insensitive)
 *   2. parenthetical-stripped name
 *   3. substring fuzzy
 */
export async function syncScoresFromSiakang(userId, targetSemester, sourceSemester) {
  const credentials = await siakangCredentialsOf(userId);

  if (!credentials) {
    throw new ApiError('Kredensial Siakang belum diatur. Tambahkan di Pengaturan.', 422);
  }

  const response = await getGrades(credentials.email, credentials.password, sourceSemester);

  if ((response.code ?? 0) !== 200) {
    throw new ApiError(
      response.message ?? 'Gagal mengambil nilai dari Siakang.',
      Number(response.code) || 502
    );
  }

  const data = response.data ?? {};
  const courses = Array.isArray(data.courses) ? data.courses : [];

  if (courses.length === 0) {
    throw new ApiError('Tidak ada data nilai pada respons Siakang.', 422);
  }

  const userCourses = await prisma.courseContent.findMany({
    where: {
      user_id: userId,
      ...(targetSemester ? { semester: targetSemester } : {}),
    },
  });

  let updated = 0;
  let unchanged = 0;
  const noMatch = [];

  for (const course of courses) {
    const name = String(course.name ?? '').trim();
    const rawScore = course.score ?? null;

    // Only published numeric scores can be synced.
    if (name === '' || rawScore === null || Number.isNaN(Number(rawScore))) {
      if (name !== '') noMatch.push(`${name} (nilai belum dirilis)`);
      continue;
    }

    const numericScore = Number(rawScore);
    const matkulName = stripParenthetical(name);

    let match = userCourses.find(
      (c) => String(c.course_content).trim().toLowerCase() === name.toLowerCase()
    );

    if (!match) {
      match = userCourses.find(
        (c) => stripParenthetical(c.course_content).toLowerCase() === matkulName.toLowerCase()
      );
    }

    if (!match && matkulName !== '') {
      match = userCourses.find((c) => {
        const local = stripParenthetical(c.course_content).toLowerCase();
        return (
          c.course_content.toLowerCase().includes(matkulName.toLowerCase()) ||
          matkulName.toLowerCase().includes(local)
        );
      });
    }

    if (!match) {
      noMatch.push(name);
      continue;
    }

    const existingScore = match.score === null ? null : Number(match.score);
    const isSame = existingScore !== null && Math.abs(existingScore - numericScore) < 0.0001;

    if (isSame) {
      unchanged += 1;
      continue;
    }

    await prisma.courseContent.update({
      where: { id: match.id },
      data: { score: numericScore },
    });

    updated += 1;
  }

  return {
    updated,
    unchanged,
    no_match: noMatch,
    semester_label: targetSemester ?? null,
    ip: data.ip ?? null,
    ipk: data.ipk ?? null,
  };
}

function stripParenthetical(value) {
  return String(value ?? '').replace(/\s*\([^)]*\)\s*$/, '').trim();
}

export { decimal2 };
