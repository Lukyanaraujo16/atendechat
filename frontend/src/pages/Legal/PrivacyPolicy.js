import React from "react";
import LegalPageLayout, { LegalSection } from "./LegalPageLayout";
import { LEGAL_UPDATED_AT, PRIVACY_SECTIONS } from "./legalContent";

export default function PrivacyPolicy() {
  return (
    <LegalPageLayout title="Política de Privacidade" updatedAt={LEGAL_UPDATED_AT}>
      {PRIVACY_SECTIONS.map((section) => (
        <LegalSection
          key={section.title}
          title={section.title}
          paragraphs={section.paragraphs || []}
          list={section.list || []}
          paragraphsAfterList={section.paragraphsAfterList || []}
        />
      ))}
    </LegalPageLayout>
  );
}
