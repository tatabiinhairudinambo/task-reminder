import { prisma } from '@/lib/db';
import { ApiError } from '@/lib/api-response';
import { serializeGrade, num } from '@/lib/serialize';

// Port of App\Services\GradeService.
//
// Laravel ordered with a raw `CASE grade` so A+ sorts above F and unknown
// labels land last. That ordering is encoded here in JS instead of raw SQL,
// keeping it portable and identical on Postgres.

const GRADE_ORDER = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D', 'E', 'F'];

function gradeRank(grade) {
  const index = GRADE_ORDER.indexOf(String(grade).trim().toUpperCase());
  return index === -1 ? GRADE_ORDER.length : index;
}

export async function getAll(userId) {
  const grades = await prisma.grade.findMany({ where: { user_id: userId } });

  return grades
    .sort((a, b) => gradeRank(a.grade) - gradeRank(b.grade))
    .map(serializeGrade);
}

export async function create(userId, data) {
  const existing = await prisma.grade.findFirst({
    where: { user_id: userId, grade: data.grade },
  });

  if (existing) {
    throw new ApiError('Kolom grade sudah digunakan.', 422, {
      grade: ['Kolom grade sudah digunakan.'],
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

  return serializeGrade(grade);
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
    throw new ApiError('Kolom grade sudah digunakan.', 422, {
      grade: ['Kolom grade sudah digunakan.'],
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

  return serializeGrade(grade);
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
