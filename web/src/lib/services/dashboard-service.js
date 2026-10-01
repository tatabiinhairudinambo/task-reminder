import { prisma } from '@/lib/db';
import { num, decimal2, boolInt, dateOnly, deadlineLabel } from '@/lib/serialize';

// Port of App\Services\DashboardService.
//
// The Laravel version used `sum(case when status then ... end)` raw SQL for
// Postgres portability. Prisma's groupBy/count keeps that portable without
// raw SQL, so the counts are computed with two aggregate queries.

export async function getDashboard(userId) {
  const [total, completed, tasks] = await Promise.all([
    prisma.task.count({ where: { user_id: userId } }),
    prisma.task.count({ where: { user_id: userId, status: true } }),
    prisma.task.findMany({
      where: { user_id: userId },
      orderBy: { deadline: 'asc' },
      select: {
        id: true,
        course_content_id: true,
        task: true,
        description: true,
        deadline: true,
        priority: true,
        status: true,
        courseContent: {
          select: { id: true, semester: true, code: true, course_content: true },
        },
      },
    }),
  ]);

  return {
    completed_task: completed,
    uncompleted_task: total - completed,
    total_task: total,
    tasks: tasks.map((task) => ({
      id: num(task.id),
      semester: task.courseContent?.semester ?? null,
      code: task.courseContent?.code ?? null,
      course_content_id: task.courseContent ? num(task.courseContent.id) : null,
      course_content: task.courseContent?.course_content ?? null,
      task: task.task,
      description: task.description ?? null,
      deadline: dateOnly(task.deadline),
      priority: boolInt(task.priority),
      deadline_label: deadlineLabelFor(task),
      status: boolInt(task.status),
    })),
  };
}

export async function getChart(userId, semester) {
  const contents = await prisma.courseContent.findMany({
    where: { user_id: userId, semester },
    orderBy: { course_content: 'asc' },
    select: {
      id: true,
      course_content: true,
      tasks: {
        select: {
          id: true,
          course_content_id: true,
          task: true,
          status: true,
          deadline: true,
          created_at: true,
          updated_at: true,
        },
      },
    },
  });

  let totalCompleted = 0;
  let totalUncompleted = 0;

  const courseContents = contents.map((content) => {
    const completed = content.tasks.filter((t) => t.status).length;
    const uncompleted = content.tasks.filter((t) => !t.status).length;

    totalCompleted += completed;
    totalUncompleted += uncompleted;

    return {
      id: num(content.id),
      course_content: content.course_content,
      completed_task: completed,
      uncompleted_task: uncompleted,
      total_task: completed + uncompleted,
      tasks: content.tasks.map((task) => ({
        id: num(task.id),
        course_content_id: num(task.course_content_id),
        task: task.task,
        status: boolInt(task.status),
        // Laravel rendered these with `j F Y` in the app locale; the SPA only
        // ever displays them, so the same format is reproduced here.
        deadline: formatLongDate(task.deadline),
        created_at: formatLongDate(task.created_at),
        updated_at: formatLongDate(task.updated_at),
        deadline_label: deadlineLabelFor(task),
      })),
    };
  });

  return {
    semester,
    course_contents: courseContents,
    completed_task: totalCompleted,
    uncompleted_task: totalUncompleted,
    total_task: totalCompleted + totalUncompleted,
  };
}

export async function getSemesterOverview(userId) {
  const [grades, contents] = await Promise.all([
    prisma.grade.findMany({ where: { user_id: userId } }),
    prisma.courseContent.findMany({
      where: { user_id: userId },
      orderBy: { course_content: 'asc' },
      select: {
        id: true,
        semester: true,
        credits: true,
        score: true,
        tasks: { select: { id: true, status: true } },
      },
    }),
  ]);

  if (contents.length === 0) {
    return {
      semesters: [],
      cumulative_gpa: 0,
      total_credits_all: 0,
      total_task_all: 0,
      completed_task_all: 0,
      uncompleted_task_all: 0,
    };
  }

  // Group by semester, ordered by the number found in the label.
  const grouped = new Map();

  for (const content of contents) {
    const list = grouped.get(content.semester) ?? [];
    list.push(content);
    grouped.set(content.semester, list);
  }

  const ordered = [...grouped.entries()].sort(
    (a, b) => extractSemesterNumber(a[0]) - extractSemesterNumber(b[0])
  );

  let totalWeightedAll = 0;
  let totalCreditsAll = 0;
  let totalTaskAll = 0;
  let completedTaskAll = 0;
  let uncompletedTaskAll = 0;
  const semesters = [];

  for (const [semester, list] of ordered) {
    const totalCredits = list.reduce((sum, c) => sum + Number(c.credits), 0);
    const completed = list.reduce((sum, c) => sum + c.tasks.filter((t) => t.status).length, 0);
    const uncompleted = list.reduce((sum, c) => sum + c.tasks.filter((t) => !t.status).length, 0);
    const totalTask = completed + uncompleted;

    const mapped = list.map((content) => {
      const score = content.score === null ? null : Number(content.score);

      const grade =
        score === null
          ? null
          : grades.find(
              (g) => score >= Number(g.minimal_score) && score <= Number(g.maximal_score)
            ) ?? null;

      return {
        score,
        credits: Number(content.credits),
        grade_point: grade ? Number(grade.grade_point) : 0,
        has_grade_mapping: grade !== null,
      };
    });

    const hasIncomplete = mapped.some((m) => m.score === null || !m.has_grade_mapping);
    let semesterGpa = 0;

    if (!hasIncomplete && mapped.length > 0) {
      const weighted = mapped.reduce((sum, m) => sum + m.grade_point * m.credits, 0);
      semesterGpa = totalCredits > 0 ? weighted / totalCredits : 0;

      totalWeightedAll += weighted;
      totalCreditsAll += totalCredits;
    }

    totalTaskAll += totalTask;
    completedTaskAll += completed;
    uncompletedTaskAll += uncompleted;

    semesters.push({
      semester,
      semester_gpa: round2(semesterGpa),
      total_credits: totalCredits,
      total_task: totalTask,
      completed_task: completed,
      uncompleted_task: uncompleted,
      has_complete_scores: !hasIncomplete,
    });
  }

  return {
    semesters,
    cumulative_gpa: totalCreditsAll > 0 ? round2(totalWeightedAll / totalCreditsAll) : 0,
    total_credits_all: totalCreditsAll,
    total_task_all: totalTaskAll,
    completed_task_all: completedTaskAll,
    uncompleted_task_all: uncompletedTaskAll,
  };
}

// ------------------------------------------------------------------ helpers

export function extractSemesterNumber(semester) {
  const match = /(\d+)/.exec(semester ?? '');
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

/**
 * `j F Y` with Carbon's `format()` - English month names, because
 * DashboardService uses `format`, not `translatedFormat` (only the reminder
 * mail and Telegram deadlines use the Indonesian locale).
 */
export function formatLongDate(value) {
  if (value === null || value === undefined) return null;

  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;

  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: process.env.APP_TIMEZONE || 'Asia/Jakarta',
  }).format(d);
}

function deadlineLabelFor(task) {
  return deadlineLabel(task.deadline, task.status);
}

export { decimal2 };
