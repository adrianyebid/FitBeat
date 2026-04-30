type UserContact = {
    email: string;
    firstName?: string;
    lastName?: string;
};

export async function fetchUserContact(userId: string): Promise<UserContact> {
    const authApiUrl = (process.env.USER_SERVICE_URL || 'http://component_a:8000').replace(/\/$/, '');
    const internalToken = process.env.INTERNAL_SERVICE_TOKEN || '';

    if (!internalToken) {
        throw new Error('INTERNAL_SERVICE_TOKEN es requerido para consultar contacto de usuarios');
    }

    const response = await fetch(`${authApiUrl}/api/auth/internal/contact/${encodeURIComponent(userId)}`, {
        headers: {
            'X-Internal-Token': internalToken,
        },
    });

    if (!response.ok) {
        throw new Error(`user-service respondio ${response.status} al consultar contacto`);
    }

    const payload = (await response.json()) as {
        email?: string;
        first_name?: string;
        last_name?: string;
        firstName?: string;
        lastName?: string;
    };

    if (!payload.email) {
        throw new Error('user-service no devolvio email para el usuario');
    }

    return {
        email: payload.email,
        firstName: payload.first_name || payload.firstName,
        lastName: payload.last_name || payload.lastName,
    };
}
