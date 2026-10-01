import { prisma } from '@/lib/db';
import { ApiError } from '@/lib/api-response';
import { serializeGradeIndex, serializeGradeRaw, num } from '@/lib/serialize';

// Port of App\Services\GradeService.
//
// Laravel ordered with a raw `CASE grade` so A+ sorts above F and unknown
// labels land last. That ordering is encoded here in JS instead of raw SQL,
// keeping it portable and identical on Postgres.

const GRADE_ORDER = [
  'A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'E', 'F',
];

function gradeRank(grade) {
  const index = GRADE_ORDER.indexOf(String(grade).trim().toUpperCase());
  return index === -1 ? GRADE_ORDER.length : index;
}

export async function getAll(userId) {
  const grades = await prisma.grade.findMany({ where: { user_id: userId } });

  // Laravel's index mapped only id/grade/grade_point/minimal_score/
  // maximal_score - no user_id, decimals as 2-dp strings.
  return grades
    .sort((a, b) => gradeRank(a.grade) - gradeRank(b.grade))
    .map(serializeGradeIndex);
}

export async function create(userId, data) {
  const existing = await prisma.grade.findFirst({
    where: { user_id: userId, grade: data.grade },
  });

  if (existing) {
    // Laravel enforced this with Rule::unique('grades')->where(user_id), so
    // the Form Request emitted the standard English unique message.
    throw new ApiError('The grade has already been taken.', 422, {
      grade: ['The grade has already been taken.'],
    });
  }

  const grade = await prisma.grade.create({
    data: {
      user_id: userId,
      grade: data.grade,
      grade_point: data.grade_point,
      minimal_score: data.minimal_score,
      maximal_score: data.maximal_score,
    },
  });

  return serializeGradeRaw(grade);
}

export async function update(userId, id, data) {
  const existing = await prisma.grade.findFirst({
    where: { id: BigInt(id), user_id: userId },
  });

  if (!existing) {
    throw new ApiError('Nilai tidak ditemukan', 404);
  }

  const duplicate = await prisma.grade.findFirst({
    where: { user_id: userId, grade: data.grade, id: { not: existing.id } },
  });

  if (duplicate) {
    throw new ApiError('The grade has already been taken.', 422, {
      grade: ['The grade has already been taken.'],
    });
  }

  const grade = await prisma.grade.update({
    where: { id: existing.id },
    data: {
      grade: data.grade,
      grade_point: data.grade_point,
      minimal_score: data.minimal_score,
      maximal_score: data.maximal_score,
    },
  });

  return serializeGradeRaw(grade);
}

export async function remove(userId, id) {
  const existing = await prisma.grade.findFirst({
    where: { id: BigInt(id), user_id: userId },
  });

  if (!existing) {
    throw new ApiError('Nilai tidak ditemukan', 404);
  }

  await prisma.grade.delete({ where: { id: existing.id } });

  return num(id);
}
