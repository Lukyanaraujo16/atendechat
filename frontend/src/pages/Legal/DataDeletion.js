import React, { useEffect } from "react";
import Box from "@material-ui/core/Box";
import Typography from "@material-ui/core/Typography";
import Link from "@material-ui/core/Link";
import LegalPageLayout from "./LegalPageLayout";

const PAGE_TITLE = "Solicitação de Exclusão de Dados | StreamHub Chat";
const META_DESCRIPTION =
  "Saiba como solicitar a exclusão dos seus dados no StreamHub Chat. Envie um e-mail com os dados da conta para processarmos sua solicitação conforme a LGPD.";

const CONTACT_EMAIL = "lukyanaraujo.ob@gmail.com";
const EMAIL_SUBJECT = "Exclusão de Dados - StreamHub Chat";
const UPDATED_AT = "Junho de 2026";

const mailtoHref = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(EMAIL_SUBJECT)}`;

function usePageMeta(title, description) {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = title;

    let meta = document.querySelector('meta[name="description"]');
    const created = !meta;
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "description");
      document.head.appendChild(meta);
    }
    const previousContent = meta.getAttribute("content");
    meta.setAttribute("content", description);

    return () => {
      document.title = previousTitle;
      if (created) {
        meta.remove();
      } else if (previousContent != null) {
        meta.setAttribute("content", previousContent);
      }
    };
  }, [title, description]);
}

export default function DataDeletion() {
  usePageMeta(PAGE_TITLE, META_DESCRIPTION);

  return (
    <LegalPageLayout title="Solicitação de Exclusão de Dados" updatedAt={UPDATED_AT}>
      <Typography variant="body1" color="textSecondary" paragraph style={{ lineHeight: 1.7 }}>
        Caso você deseje solicitar a exclusão dos seus dados relacionados ao uso do StreamHub
        Chat, envie um e-mail para:
      </Typography>

      <Box mb={2}>
        <Link href={mailtoHref} color="primary" variant="body1" style={{ fontWeight: 600 }}>
          {CONTACT_EMAIL}
        </Link>
      </Box>

      <Typography variant="body1" color="textSecondary" paragraph style={{ lineHeight: 1.7 }}>
        <strong>Assunto:</strong> {EMAIL_SUBJECT}
      </Typography>

      <Typography variant="body1" color="textSecondary" paragraph style={{ lineHeight: 1.7 }}>
        Informe:
      </Typography>

      <Box component="ul" m={0} mb={3} pl={3}>
        {["Nome da empresa", "Nome do usuário", "E-mail utilizado na plataforma"].map(
          (item) => (
            <Typography
              key={item}
              component="li"
              variant="body1"
              color="textSecondary"
              paragraph
              style={{ lineHeight: 1.7 }}
            >
              {item}
            </Typography>
          )
        )}
      </Box>

      <Typography variant="body1" color="textSecondary" paragraph style={{ lineHeight: 1.7 }}>
        Após a confirmação da solicitação, os dados serão analisados e removidos conforme
        aplicável, respeitando obrigações legais e contratuais.
      </Typography>
    </LegalPageLayout>
  );
}
