import { prisma } from '@/lib/db';
import { ApiError } from '@/lib/api-response';
import { num, boolInt, dateOnly, deadlineLabel, serializeCourseContent } from '@/lib/serialize';
import { siakangCredentialsOf } from '@/lib/services/settings-service';
import { getSchedule } from '@/lib/services/siakang-client';

// Port of App\Services\CourseContentService.

const DAY_ORDER = {
  monday: 1, senin: 1,
  tuesday: 2, selasa: 2,
  wednesday: 3, rabu: 3,
  thursday: 4, kamis: 4,
  friday: 5, jumat: 5,
  saturday: 6, sabtu: 6,
  sunday: 7, minggu: 7,
};

function dayRank(day) {
  return DAY_ORDER[String(day ?? '').trim().toLowerCase()] ?? 99;
}

/**
 * Filter course contents by semester. Ordering reproduces the Laravel raw
 * `CASE LOWER(day)` + hour_start + course_content sort, computed in JS so no
 * database-specific SQL is needed.
 */
export async function filter(userId, semester) {
  const contents = await prisma.courseContent.findMany({
    where: { user_id: userId, semester },
    select: {
      id: true,
      semester: true,
      code: true,
      course_content: true,
      credits: true,
      lecturer: true,
      day: true,
      hour_start: true,
      hour_end: true,
      tasks: {
        where: { user_id: userId },
        orderBy: { deadline: 'asc' },
        select: {
          id: true,
          task: true,
          description: true,
          deadline: true,
          priority: true,
          status: true,
        },
      },
    },
  });

  const sorted = contents.sort((a, b) => {
    const byDay = dayRank(a.day) - dayRank(b.day);
    if (byDay !== 0) return byDay;

    const aHour = a.hour_start instanceof Date ? a.hour_start.getTime() : 0;
    const bHour = b.hour_start instanceof Date ? b.hour_start.getTime() : 0;
    if (aHour !== bHour) return aHour - bHour;

    return String(a.course_content).localeCompare(String(b.course_content));
  });

  const courseContents = sorted.map((content) => ({
    id: num(content.id),
    semester: content.semester,
    code: content.code,
    course_content: content.course_content,
    credits: num(content.credits),
    lecturer: content.lecturer,
    day: content.day,
    hour_start: timeHm(content.hour_start),
    hour_end: timeHm(content.hour_end),
    tasks: content.tasks.map((task) => ({
      id: num(task.id),
      task: task.task,
      description: task.description ?? null,
      deadline: dateOnly(task.deadline),
      priority: boolInt(task.priority),
      status: boolInt(task.status),
      deadline_label: deadlineLabel(task.deadline, task.status),
    })),
  }));

  return {
    total_credits: courseContents.reduce((sum, c) => sum + Number(c.credits), 0),
    course_contents: courseContents,
  };
}

function timeHm(value) {
  if (!(value instanceof Date)) return value ?? null;
  return value.toISOString().slice(11, 16);
}

export async function create(userId, data) {
  const [codeExists, contentExists] = await Promise.all([
    prisma.courseContent.findFirst({
      where: { user_id: userId, code: data.code, semester: data.semester },
      select: { id: true },
    }),
    prisma.courseContent.findFirst({
      where: { user_id: userId, course_content: data.course_content, semester: data.semester },
      select: { id: true },
    }),
  ]);

  if (codeExists || contentExists) {
    throw new ApiError('Mata kuliah sudah ditambahkan', 409);
  }

  const created = await prisma.courseContent.create({
    data: {
      semester: data.semester,
      code: data.code,
      course_content: data.course_content,
      credits: data.credits,
      lecturer: data.lecturer,
      day: data.day,
      hour_start: timeToDate(data.hour_start),
      hour_end: timeToDate(data.hour_end),
      user_id: userId,
    },
  });

  return serializeCourseContent(created);
}

export async function update(userId, id, data) {
  const existing = await prisma.courseContent.findFirst({
    where: { id: BigInt(id), user_id: userId },
  });

  if (!existing) {
    throw new ApiError('Mata kuliah tidak ditemukan', 404);
  }

  const duplicateCode = await prisma.courseContent.findFirst({
    where: {
      user_id: userId,
      id: { not: existing.id },
      code: data.code,
      semester: data.semester,
    },
    select: { id: true },
  });

  if (duplicateCode) {
    throw new ApiError('Kode sudah ada untuk pengguna ini', 409);
  }

  const duplicateContent = await prisma.courseContent.findFirst({
    where: {
      user_id: userId,
      id: { not: existing.id },
      course_content: data.course_content,
      semester: data.semester,
    },
    select: { id: true },
  });

  if (duplicateContent) {
    throw new ApiError('Mata kuliah sudah ada untuk pengguna ini', 409);
  }

  const updated = await prisma.courseContent.update({
    where: { id: existing.id },
    data: {
      semester: data.semester,
      code: data.code,
      course_content: data.course_content,
      credits: data.credits,
      lecturer: data.lecturer,
      day: data.day,
      hour_start: timeToDate(data.hour_start),
      hour_end: timeToDate(data.hour_end),
    },
  });

  return serializeCourseContent(updated);
}

export async function remove(userId, id) {
  const existing = await prisma.courseContent.findFirst({
    where: { id: BigInt(id), user_id: userId },
  });

  if (!existing) {
    throw new ApiError('Mata kuliah tidak ditemukan', 404);
  }

  await prisma.courseContent.delete({ where: { id: existing.id } });

  return true;
}

/** Delete every course in a semester. Tasks go with them via the FK cascade. */
export async function clearSemester(userId, semester) {
  return prisma.$transaction(async (tx) => {
    const courses = await tx.courseContent.findMany({
      where: { user_id: userId, semester },
      select: { id: true, score: true },
    });

    const courseIds = courses.map((c) => c.id);
    const taskCount =
      courseIds.length > 0
        ? await tx.task.count({ where: { course_content_id: { in: courseIds } } })
        : 0;
    const scoredCount = courses.filter((c) => c.score !== null).length;

    if (courseIds.length > 0) {
      await tx.courseContent.deleteMany({ where: { id: { in: courseIds } } });
    }

    return {
      semester,
      deleted_courses: courseIds.length,
      deleted_tasks: taskCount,
      cleared_scores: scoredCount,
    };
  });
}

// ------------------------------------------------------------ Siakang sync

/** "C24" -> "C", "A" -> "A" */
function classLetter(value) {
  const trimmed = String(value ?? '').trim();
  return trimmed === '' ? '' : trimmed.charAt(0).toUpperCase();
}

function normalizeDay(day) {
  if (!day) return null;
  return DAY_ORDER[String(day).trim().toLowerCase()] ? capitalizeDay(day) : null;
}

function capitalizeDay(day) {
  const map = {
    senin: 'Senin', monday: 'Senin',
    selasa: 'Selasa', tuesday: 'Selasa',
    rabu: 'Rabu', wednesday: 'Rabu',
    kamis: 'Kamis', thursday: 'Kamis',
    jumat: 'Jumat', friday: 'Jumat',
    sabtu: 'Sabtu', saturday: 'Sabtu',
    minggu: 'Minggu', sunday: 'Minggu',
  };
  return map[String(day).trim().toLowerCase()] ?? null;
}

/** "07:30 - 09:10" -> "07:30" */
function normalizeTimeStart(time) {
  if (!time) return null;
  const parts = String(time).trim().split(/\s*-\s*/);
  return parts[0] ? parts[0].trim().slice(0, 5) : null;
}

/** "07:30 - 09:10" -> "09:10" */
function normalizeTimeEnd(time) {
  if (!time) return null;
  const parts = String(time).trim().split(/\s*-\s*/);
  return parts[1] ? parts[1].trim().slice(0, 5) : null;
}

/** Convert "HH:mm" into the Date Prisma expects for a @db.Time(0) column. */
function timeToDate(value) {
  if (value instanceof Date) return value;
  const [h, m] = String(value ?? '00:00').split(':');
  return new Date(Date.UTC(1970, 0, 1, Number(h) || 0, Number(m) || 0, 0));
}

export async function syncScheduleFromSiakang(userId, targetSemester, sourceSemester) {
  const semesterLabel = String(targetSemester ?? '').trim();

  if (semesterLabel === '') {
    throw new ApiError('Semester wajib diisi.', 422);
  }

  const credentials = await siakangCredentialsOf(userId);

  if (!credentials) {
    throw new ApiError('Kredensial Siakang belum diatur. Tambahkan di Pengaturan.', 422);
  }

  const response = await getSchedule(credentials.email, credentials.password, sourceSemester);

  if ((response.code ?? 0) !== 200) {
    throw new ApiError(
      response.message ?? 'Gagal mengambil jadwal dari Siakang.',
      Number(response.code) || 502
    );
  }

  const rows = Array.isArray(response.data) ? response.data : [];

  if (rows.length === 0) {
    throw new ApiError('Tidak ada data jadwal pada respons Siakang.', 422);
  }

  return prisma.$transaction(async (tx) => {
    // Re-syncing into a non-empty semester would cascade-delete existing tasks
    // and scores, so it is refused; the caller must clear it explicitly first.
    const alreadyExists = await tx.courseContent.findFirst({
      where: { user_id: userId, semester: semesterLabel },
      select: { id: true },
    });

    if (alreadyExists) {
      throw new ApiError(
        'Semester sudah memiliki data mata kuliah. Bersihkan terlebih dahulu untuk sinkron ulang.',
        409
      );
    }

    let inserted = 0;
    const skipped = [];
    const insertedCodes = new Set();

    for (const course of rows) {
      let name = String(course.name ?? '').trim();
      const code = String(course.code ?? '').trim();
      const credits = Number.parseInt(course.credits ?? 0, 10) || 0;
      const schedules = Array.isArray(course.schedules) ? course.schedules : [];
      const lecturers = Array.isArray(course.lecturers) ? course.lecturers : [];

      const header = course.detail?.header ?? {};
      const classCode = String(header.kelas ?? '').trim();
      let lecturer = String(header.dosen ?? '').trim();
      const letter = classLetter(classCode);

      if (lecturer === '' && lecturers.length > 0) {
        lecturer = lecturers.join(', ');
      }

      if (letter !== '' && !name.includes(`(${letter})`)) {
        name = `${name} (${letter})`;
      }

      if (name === '' || credits <= 0) {
        skipped.push(name !== '' ? name : '(unknown course)');
        continue;
      }

      if (code !== '' && insertedCodes.has(code)) {
        skipped.push(name);
        continue;
      }

      const first = schedules[0] ?? {};

      await tx.courseContent.create({
        data: {
          semester: semesterLabel,
          code,
          course_content: name,
          credits,
          lecturer,
          day: normalizeDay(first.day) ?? '',
          hour_start: timeToDate(normalizeTimeStart(first.time) ?? '00:00'),
          hour_end: timeToDate(normalizeTimeEnd(first.time) ?? '00:00'),
          user_id: userId,
        },
      });

      inserted += 1;
      if (code !== '') insertedCodes.add(code);
    }

    return { inserted, skipped, semester_label: semesterLabel };
  });
}

export { timeToDate, classLetter, normalizeDay, normalizeTimeStart, normalizeTimeEnd };
