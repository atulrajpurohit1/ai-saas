"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const OLD_EMAIL = 'videodesigner@gmail.com';
const ADMIN_EMAIL = 'videodesigner.admin@gmail.com';
const GUARD_EMAIL = 'videodesigner.guard@gmail.com';
const CLIENT_EMAIL = 'videodesigner.client@gmail.com';
async function main() {
    const user = await prisma.user.update({
        where: { email: OLD_EMAIL },
        data: { email: ADMIN_EMAIL },
    });
    console.log('Updated admin user email:', user.id, user.email);
    const guard = await prisma.guard.findFirst({ where: { email: OLD_EMAIL } });
    if (!guard)
        throw new Error('Guard not found with old email');
    const updatedGuard = await prisma.guard.update({
        where: { id: guard.id },
        data: { email: GUARD_EMAIL },
    });
    console.log('Updated guard email:', updatedGuard.id, updatedGuard.email);
    const clientUser = await prisma.clientUser.update({
        where: { email: OLD_EMAIL },
        data: { email: CLIENT_EMAIL },
    });
    console.log('Updated clientUser email:', clientUser.id, clientUser.email);
    const clientUpdated = await prisma.client.update({
        where: { id: clientUser.clientId },
        data: { email: CLIENT_EMAIL },
    });
    console.log('Updated client company email:', clientUpdated.id, clientUpdated.email);
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(() => prisma.$disconnect());
//# sourceMappingURL=update_videodesigner_emails.js.map