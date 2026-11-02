import { Module } from '@nestjs/common';
import { CertificateController } from './certificateController';
import { CertificateRepository } from './certificateRepository';
import { CertificateService } from './certificateService';

@Module({ controllers: [CertificateController], providers: [CertificateRepository, CertificateService] })
export class CertificateModule {}
