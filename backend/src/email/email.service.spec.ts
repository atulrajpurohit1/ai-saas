import { Test, TestingModule } from '@nestjs/testing';
import { BrandingService } from '../branding/branding.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from './email.service';

describe('EmailService', () => {
  let service: EmailService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        { provide: PrismaService, useValue: {} },
        {
          provide: BrandingService,
          useValue: {
            brandingSnapshot: jest.fn(),
            emailShell: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
