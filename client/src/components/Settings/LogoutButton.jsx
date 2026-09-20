import { Button } from '@/components/ui/button';

export const LogoutButton = ({ isLoading, onLogout }) => {
    return (
        <Button className="block w-full lg:hidden" variant="destructive" disabled={isLoading} onClick={onLogout}>
            {isLoading ? 'Keluar...' : 'Keluar'}
        </Button>
    );
};
