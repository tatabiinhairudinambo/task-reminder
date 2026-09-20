import { useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { DashboardView } from '@/components/Dashboard/DashboardView';

const Dashboard = () => {
    useEffect(() => {
        document.title = 'Beranda - Task Reminder';
    }, []);

    return (
        <AppLayout title="Beranda">
            <DashboardView />
        </AppLayout>
    );
};

export default Dashboard;
