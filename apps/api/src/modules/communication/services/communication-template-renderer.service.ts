import { Injectable } from '@nestjs/common';

@Injectable()
export class CommunicationTemplateRendererService {
  render(
    template: string | null | undefined,
    variables: Record<string, string>,
  ): string {
    if (!template) return '';
    return template.replace(
      /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g,
      (_, key: string) => {
        return variables[key] ?? '';
      },
    );
  }

  renderAll(
    input: {
      subject?: string | null;
      bodyHtml?: string | null;
      bodyText?: string | null;
    },
    variables: Record<string, string>,
  ) {
    return {
      subject: this.render(input.subject, variables),
      bodyHtml: this.render(input.bodyHtml, variables),
      bodyText: this.render(input.bodyText, variables),
    };
  }
}
