/**
 * Modelos padrão quando não há valor na BD (ou string vazia).
 * Tags: {{companyName}} {{userName}} {{userEmail}} {{temporaryPassword}} {{resetLink}} {{loginUrl}} {{systemName}} {{supportEmail}}
 */
export const DEFAULT_WELCOME_SUBJECT =
  "Bem-vindo à {{systemName}} — seu acesso foi criado";

export const DEFAULT_WELCOME_BODY = `Olá, {{userName}}!

Sua empresa {{companyName}} já está cadastrada na {{systemName}}.

Acesse a plataforma pelo link abaixo:
{{loginUrl}}

Dados de acesso:
E-mail: {{userEmail}}
Senha provisória: {{temporaryPassword}}

Por segurança, recomendamos alterar sua senha no primeiro acesso.

Se precisar de ajuda, entre em contato pelo e-mail {{supportEmail}}.

Atenciosamente,
Equipe {{systemName}}`;

export const DEFAULT_PASSWORD_RESET_SUBJECT =
  "Redefinição de senha — {{systemName}}";

export const DEFAULT_PASSWORD_RESET_BODY = `Olá, {{userName}}!

Recebemos uma solicitação para redefinir sua senha na {{systemName}}.

Clique no link abaixo para criar uma nova senha:
{{resetLink}}

Se você não solicitou essa alteração, ignore este e-mail.

Atenciosamente,
Equipe {{systemName}}`;
