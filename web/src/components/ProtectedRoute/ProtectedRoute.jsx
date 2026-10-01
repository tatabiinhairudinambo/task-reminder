'use client';

import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';

// Kept for parity with the SPA's component of the same name (no current
// importer). Unlike the SPA version it cannot read localStorage during render
// on the server, so it resolves the snapshot in an effect.

const ProtectedRoute = ({ children }) => {
    const [auth, setAuth] = useState(null);

    useEffect(() => {
        setAuth({
            token: localStorage.getItem('token'),
            emailVerified: localStorage.getItem('isEmailVerified'),
        });
    }, []);

    if (auth === null) {
        return null;
    }

    if (!auth.token) {
        return <Navigate to="/auth/login" replace />;
    }

    if (auth.emailVerified === 'false') {
        return <Navigate to="/auth/verify-email" replace />;
    }

    return children;
};

export default ProtectedRoute;
