import React from "react";
import LegalPageLayout, { LegalSection } from "./LegalPageLayout";
import { LEGAL_UPDATED_AT, TERMS_SECTIONS } from "./legalContent";

export default function TermsOfService() {
  return (
    <LegalPageLayout title="Termos de Uso" updatedAt={LEGAL_UPDATED_AT}>
      {TERMS_SECTIONS.map((section) => (
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
