'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { QuestionBankMastersPanel } from './question-bank-masters-panel';
import { QuestionBankPapersPanel } from './question-bank-papers-panel';
import { QuestionBankSettingsPanel } from './question-bank-settings-panel';

export function QuestionBankView({ onMessage }: { onMessage: (message: string) => void }) {
  return (
    <Tabs defaultValue="papers" className="space-y-3">
      <TabsList>
        <TabsTrigger value="papers">Question papers</TabsTrigger>
        <TabsTrigger value="masters">Master data</TabsTrigger>
        <TabsTrigger value="settings">Settings</TabsTrigger>
      </TabsList>
      <TabsContent value="papers">
        <QuestionBankPapersPanel onMessage={onMessage} />
      </TabsContent>
      <TabsContent value="masters">
        <QuestionBankMastersPanel onMessage={onMessage} />
      </TabsContent>
      <TabsContent value="settings">
        <QuestionBankSettingsPanel onMessage={onMessage} />
      </TabsContent>
    </Tabs>
  );
}
