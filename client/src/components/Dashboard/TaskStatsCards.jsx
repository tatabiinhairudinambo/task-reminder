import { memo } from 'react';
import { ListChecks, CheckCircle2, Clock } from 'lucide-react';
import { StatCard } from '@/components/shared/StatCard';

export const TaskStatsCards = memo(({ totalTasks, completedCount, uncompletedCount, isLoading }) => {
    return (
        <div className="my-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard
                title="Total Tugas"
                value={totalTasks}
                subtitle="Bulan ini"
                icon={ListChecks}
                iconColor="text-primary"
                isLoading={isLoading}
            />
            <StatCard
                title="Tugas Selesai"
                value={completedCount}
                subtitle="Bulan ini"
                icon={CheckCircle2}
                iconColor="text-success"
                isLoading={isLoading}
            />
            <StatCard
                title="Tugas Belum Selesai"
                value={uncompletedCount}
                subtitle="Bulan ini"
                icon={Clock}
                iconColor="text-warning"
                isLoading={isLoading}
            />
        </div>
    );
});

TaskStatsCards.displayName = 'TaskStatsCards';
