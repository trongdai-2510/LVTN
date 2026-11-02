import { Module } from '@nestjs/common';
import { PartnerController } from './partnerController';
import { PartnerRepository } from './partnerRepository';
import { PartnerService } from './partnerService';

@Module({ controllers: [PartnerController], providers: [PartnerRepository, PartnerService] })
export class PartnerModule {}
