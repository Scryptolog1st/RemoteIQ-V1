// app/lib/auth.ts
export async function getMe() {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/api/auth/me`, {
        credentials: 'include',
    });
    return res.json() as Promise<{ user: null | { id: string; email: string; name: string; role: string } }>;
}
export async function logout() {
    await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/api/auth/logout`, { method: 'POST', credentials: 'include' });
}
