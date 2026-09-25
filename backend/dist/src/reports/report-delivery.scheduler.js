"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var ReportDeliveryScheduler_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportDeliveryScheduler = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const prisma_service_1 = require("../prisma/prisma.service");
const entitlements_service_1 = require("../entitlements/entitlements.service");
const reports_service_1 = require("./reports.service");
let ReportDeliveryScheduler = ReportDeliveryScheduler_1 = class ReportDeliveryScheduler {
    prisma;
    reports;
    entitlements;
    logger = new common_1.Logger(ReportDeliveryScheduler_1.name);
    running = false;
    constructor(prisma, reports, entitlements) {
        this.prisma = prisma;
        this.reports = reports;
        this.entitlements = entitlements;
    }
    async sweep() {
        if (this.running) {
            this.logger.warn('Previous sweep still running; skipping this tick.');
            return;
        }
        this.running = true;
        try {
            await this.deliverPending();
        }
        catch (error) {
            this.logger.error(`Report delivery sweep failed: ${error instanceof Error ? error.message : 'unknown error'}`);
        }
        finally {
            this.running = false;
        }
    }
    async deliverPending() {
        const since = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
        const pending = await this.prisma.dailyServiceReport.findMany({
            where: {
                status: 'published',
                reportDate: { gte: since },
                emailSentAt: null,
                client: {
                    reportEmailEnabled: true,
                    reportEmailMode: 'AUTOMATIC',
                },
            },
            include: {
                client: {
                    select: {
                        id: true,
                        name: true,
                        companyName: true,
                        email: true,
                        reportEmailEnabled: true,
                        reportEmailMode: true,
                        reportEmailCc: true,
                    },
                },
                site: { select: { id: true, name: true, address: true } },
            },
            take: 100,
        });
        if (!pending.length)
            return { considered: 0, sent: 0 };
        let sent = 0;
        for (const report of pending) {
            const entitled = await this.entitlements.hasModule(report.tenantId, 'GUARD_TOUR');
            if (!entitled)
                continue;
            const result = await this.reports.deliverReportByEmail(report, 'automatic');
            if (result.sent) {
                await this.prisma.dailyServiceReport.update({
                    where: { id: report.id },
                    data: { emailSentAt: new Date() },
                });
                sent += 1;
            }
        }
        if (sent) {
            this.logger.log(`Automatic report delivery: sent ${sent} of ${pending.length} pending.`);
        }
        return { considered: pending.length, sent };
    }
};
exports.ReportDeliveryScheduler = ReportDeliveryScheduler;
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_HOUR),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ReportDeliveryScheduler.prototype, "sweep", null);
exports.ReportDeliveryScheduler = ReportDeliveryScheduler = ReportDeliveryScheduler_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        reports_service_1.ReportsService,
        entitlements_service_1.EntitlementsService])
], ReportDeliveryScheduler);
//# sourceMappingURL=report-delivery.scheduler.js.map