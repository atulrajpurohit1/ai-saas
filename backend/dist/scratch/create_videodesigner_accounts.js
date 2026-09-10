"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcrypt = __importStar(require("bcrypt"));
const prisma = new client_1.PrismaClient();
const TENANT_ID = 'ef1b8e7e-5d01-4f08-ba69-0279dc8c9139';
const EMAIL = 'videodesigner@gmail.com';
const GUARD_PW = 'UCU6LLxpDSFDC7Ri';
const CLIENT_PW = 'ZEf#6ZBA!MKz!S#3';
const ADMIN_PW = 'ZKuXPMwm!2vP#Dye';
async function main() {
    const existingUser = await prisma.user.findUnique({ where: { email: EMAIL } });
    if (existingUser) {
        console.log('CONFLICT admin: user already exists with this email:', existingUser.id);
    }
    else {
        const hash = await bcrypt.hash(ADMIN_PW, 10);
        const user = await prisma.user.create({
            data: {
                email: EMAIL,
                password: hash,
                name: 'Video Designer',
                role: 'ADMIN',
                tenantId: TENANT_ID,
                isSuperAdmin: false,
            },
        });
        console.log('Created admin user:', user.id, user.email);
    }
    const existingGuard = await prisma.guard.findFirst({ where: { email: EMAIL } });
    if (existingGuard) {
        console.log('CONFLICT guard: guard already exists with this email:', existingGuard.id);
    }
    else {
        const hash = await bcrypt.hash(GUARD_PW, 10);
        const guard = await prisma.guard.create({
            data: {
                name: 'Video Designer',
                email: EMAIL,
                passwordHash: hash,
                tenantId: TENANT_ID,
            },
        });
        console.log('Created guard:', guard.id, guard.email);
    }
    const existingClientUser = await prisma.clientUser.findUnique({ where: { email: EMAIL } });
    if (existingClientUser) {
        console.log('CONFLICT client: clientUser already exists with this email:', existingClientUser.id);
    }
    else {
        const hash = await bcrypt.hash(CLIENT_PW, 10);
        const client = await prisma.client.create({
            data: {
                name: 'Video Designer',
                companyName: 'Video Designer',
                email: EMAIL,
                tenantId: TENANT_ID,
            },
        });
        const clientUser = await prisma.clientUser.create({
            data: {
                email: EMAIL,
                password: hash,
                clientId: client.id,
                tenantId: TENANT_ID,
            },
        });
        console.log('Created client + clientUser:', client.id, clientUser.id, clientUser.email);
    }
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(() => prisma.$disconnect());
//# sourceMappingURL=create_videodesigner_accounts.js.map