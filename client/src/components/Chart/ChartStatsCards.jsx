import { memo } from 'react';
import { ListChecks, CheckCircle2, Clock } from 'lucide-react';
import { StatCard } from '@/components/shared/StatCard';

export const ChartStatsCards = memo(({ totalTask, completedTask, uncompletedTask, selectedSemester, isLoading }) => {
    return (
        <div className="my-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard
                title="Total Tugas"
                value={totalTask}
                subtitle={`Sejak ${selectedSemester}`}
                icon={ListChecks}
                iconColor="text-primary"
                isLoading={isLoading}
            />
            <StatCard
                title="Tugas Selesai"
                value={completedTask}
                subtitle={`Sejak ${selectedSemester}`}
                icon={CheckCircle2}
                iconColor="text-success"
                isLoading={isLoading}
            />
            <StatCard
                title="Tugas Belum Selesai"
                value={uncompletedTask}
                subtitle={`Sejak ${selectedSemester}`}
                icon={Clock}
                iconColor="text-warning"
                isLoading={isLoading}
            />
        </div>
    );
});

ChartStatsCards.displayName = 'ChartStatsCards';
