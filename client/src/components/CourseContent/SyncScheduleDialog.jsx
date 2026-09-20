import { SiakangSyncDialog } from '@/components/shared/SiakangSyncDialog';

export const SyncScheduleDialog = (props) => (
    <SiakangSyncDialog
        {...props}
        title="Sinkron Jadwal dari Siakang"
        description={`Jadwal akan diimpor ke ${props.targetSemester}. Pilih semester Siakang yang ingin diambil.`}
    />
);
