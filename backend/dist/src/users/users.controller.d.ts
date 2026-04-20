import { Request } from 'express';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
export declare class UsersController {
    getMe(req: Request): ActiveUser;
}
