import { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { EntitlementsService } from '../../entitlements/entitlements.service';
export declare class ModuleGuard implements CanActivate {
    private readonly reflector;
    private readonly entitlements;
    constructor(reflector: Reflector, entitlements: EntitlementsService);
    canActivate(context: ExecutionContext): Promise<boolean>;
}
