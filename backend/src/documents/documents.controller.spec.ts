import { Test, TestingModule } from '@nestjs/testing';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { RolesService } from '../roles/roles.service';

describe('DocumentsController', () => {
  let controller: DocumentsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DocumentsController],
      providers: [
        { provide: DocumentsService, useValue: {} },
        // Documents is a CORE module, so this controller carries no
        // @RequireModule -- but it does carry PlanGuard, which needs this to
        // construct.
        {
          provide: EntitlementsService,
          useValue: { hasAnyPlan: jest.fn().mockResolvedValue(true) },
        },
        {
          provide: RolesService,
          useValue: {
            hasPermissions: jest.fn().mockResolvedValue(true),
            hasAnyPermission: jest.fn().mockResolvedValue(true),
          },
        },
      ],
    }).compile();

    controller = module.get<DocumentsController>(DocumentsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
