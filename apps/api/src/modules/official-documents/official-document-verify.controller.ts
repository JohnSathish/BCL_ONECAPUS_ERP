import { Controller, Get, Param, StreamableFile } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { OfficialDocumentService } from './services/official-document.service';

@ApiTags('verify')
@Controller({ path: 'verify/official-document', version: '1' })
export class OfficialDocumentVerifyController {
  constructor(private readonly documents: OfficialDocumentService) {}

  @Public()
  @Get(':token/pdf')
  async pdf(@Param('token') token: string) {
    const { buffer, filename } = await this.documents.getPublicPdf(token);
    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: `inline; filename="${filename}"`,
    });
  }

  @Public()
  @Get(':token')
  verify(@Param('token') token: string) {
    return this.documents.verifyPublic(token);
  }
}
