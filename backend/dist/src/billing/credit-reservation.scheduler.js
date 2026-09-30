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
var CreditReservationScheduler_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreditReservationScheduler = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const credits_service_1 = require("./credits.service");
let CreditReservationScheduler = class CreditReservationScheduler {
    static { CreditReservationScheduler_1 = this; }
    credits;
    logger = new common_1.Logger(CreditReservationScheduler_1.name);
    running = false;
    static STALE_AFTER_MINUTES = 60;
    constructor(credits) {
        this.credits = credits;
    }
    async sweep() {
        if (this.running) {
            this.logger.warn('Previous credit reservation sweep still running; skipping this tick.');
            return;
        }
        this.running = true;
        try {
            return await this.credits.expireStaleReservations(CreditReservationScheduler_1.STALE_AFTER_MINUTES);
        }
        catch (error) {
            this.logger.error(`Credit reservation sweep failed: ${error instanceof Error ? error.message : 'unknown error'}`);
            return { expired: 0, released: 0 };
        }
        finally {
            this.running = false;
        }
    }
};
exports.CreditReservationScheduler = CreditReservationScheduler;
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_HOUR),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], CreditReservationScheduler.prototype, "sweep", null);
exports.CreditReservationScheduler = CreditReservationScheduler = CreditReservationScheduler_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [credits_service_1.CreditsService])
], CreditReservationScheduler);
//# sourceMappingURL=credit-reservation.scheduler.js.map