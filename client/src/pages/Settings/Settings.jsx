import { AppLayout } from '@/components/layout/AppLayout';
import { SettingsView } from '@/components/Settings/SettingsView';

const Settings = () => {
    return (
        <AppLayout title="Pengaturan">
            <SettingsView />
        </AppLayout>
    );
};

export default Settings;
