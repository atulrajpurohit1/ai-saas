import { Test, TestingModule } from '@nestjs/testing';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { EmailController } from './email.controller';
import { EmailService } from './email.service';
import { RolesService } from '../roles/roles.service';

describe('EmailController', () => {
  let controller: EmailController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EmailController],
      providers: [
        { provide: EmailService, useValue: {} },
        {
          provide: EntitlementsService,
          useValue: { hasAnyModule: jest.fn().mockResolvedValue(true) },
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

    controller = module.get<EmailController>(EmailController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
