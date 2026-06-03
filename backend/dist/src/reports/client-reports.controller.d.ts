import { Response } from 'express';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { ReportsService } from './reports.service';
export declare class ClientReportsController {
    private readonly reportsService;
    constructor(reportsService: ReportsService);
    private getClientContext;
    findAll(user: ActiveUser): Promise<{
        id: any;
        tenantId: any;
        clientId: any;
        siteId: any;
        branchId: any;
        reportDate: any;
        status: any;
        createdAt: any;
        publishedAt: any;
        summary: {
            reportDate: string;
            site: {
                id: string;
                name: string;
                address: string;
                instructions: string | null;
            };
            client: {
                id: string;
                name: string;
                companyName: string | null;
            };
            totals: {
                shifts: number;
                assignedGuards: number;
                completedAttendances: number;
                checkedInAttendances: number;
                missedAttendances: number;
                totalWorkedHours: number;
                approvedIncidents: number;
            };
            shifts: {
                id: string;
                status: string;
                startTime: string;
                endTime: string;
                assignedGuards: {
                    id: string;
                    name: string;
                    email: string | null;
                    phone: string | null;
                    assignmentStatus: string;
                    attendanceStatus: "not_started" | "checked_in" | "completed";
                    checkInTime: string | null;
                    checkOutTime: string | null;
                    totalWorkedHours: number;
                }[];
            }[];
            incidents: {
                id: string;
                title: string;
                description: string;
                severity: string;
                occurredAt: string;
                attachmentUrl: string | null;
                guard: {
                    id: string;
                    name: string;
                };
                shift: {
                    id: string;
                    startTime: string;
                    endTime: string;
                };
            }[];
        } | {
            raw: string;
        };
        client: {
            id: any;
            name: any;
            companyName: any;
            email: any;
        } | null;
        site: {
            id: any;
            name: any;
            address: any;
        } | null;
    }[]>;
    download(user: ActiveUser, id: string, res: Response): Promise<void>;
    findOne(user: ActiveUser, id: string): Promise<{
        id: any;
        tenantId: any;
        clientId: any;
        siteId: any;
        branchId: any;
        reportDate: any;
        status: any;
        createdAt: any;
        publishedAt: any;
        summary: {
            reportDate: string;
            site: {
                id: string;
                name: string;
                address: string;
                instructions: string | null;
            };
            client: {
                id: string;
                name: string;
                companyName: string | null;
            };
            totals: {
                shifts: number;
                assignedGuards: number;
                completedAttendances: number;
                checkedInAttendances: number;
                missedAttendances: number;
                totalWorkedHours: number;
                approvedIncidents: number;
            };
            shifts: {
                id: string;
                status: string;
                startTime: string;
                endTime: string;
                assignedGuards: {
                    id: string;
                    name: string;
                    email: string | null;
                    phone: string | null;
                    assignmentStatus: string;
                    attendanceStatus: "not_started" | "checked_in" | "completed";
                    checkInTime: string | null;
                    checkOutTime: string | null;
                    totalWorkedHours: number;
                }[];
            }[];
            incidents: {
                id: string;
                title: string;
                description: string;
                severity: string;
                occurredAt: string;
                attachmentUrl: string | null;
                guard: {
                    id: string;
                    name: string;
                };
                shift: {
                    id: string;
                    startTime: string;
                    endTime: string;
                };
            }[];
        } | {
            raw: string;
        };
        client: {
            id: any;
            name: any;
            companyName: any;
            email: any;
        } | null;
        site: {
            id: any;
            name: any;
            address: any;
        } | null;
    }>;
}
