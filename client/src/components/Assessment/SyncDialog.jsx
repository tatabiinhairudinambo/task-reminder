import { SiakangSyncDialog } from '@/components/shared/SiakangSyncDialog';

export const SyncDialog = (props) => (
    <SiakangSyncDialog
        {...props}
        title="Sinkron Nilai dari Siakang"
        description={`Nilai akan disimpan ke ${props.targetSemester}. Pilih semester Siakang yang ingin diambil.`}
    />
);
