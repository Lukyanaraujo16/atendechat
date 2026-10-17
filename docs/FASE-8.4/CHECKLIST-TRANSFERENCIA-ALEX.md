# Checklist de transferência operacional — StreamHUB Chat → Alex

Objetivo: Alex passa a operar o financeiro e as assinaturas sozinho, sem SQL, SSH ou conhecimento técnico.
Este documento **não contém segredos**. Senhas, certificados e chaves são entregues pessoalmente ou por um cofre de
senhas, nunca por e-mail, WhatsApp, documento ou repositório.

Marque cada item com data e quem conferiu.

## 1. Pré-requisitos técnicos (responsável: proprietário técnico)
- [ ] Fase 8.4 + 8.4-F implantadas em **TESTE**, homologadas (HOMOLOGACAO.md) e depois em **PRODUÇÃO**.
- [ ] Migrations `20261017120000-company-registration-fields` e `20261018120000-saas-historical-review` aplicadas
      **antes** de iniciar o backend novo (HOMOLOGACAO.md §1.3).
- [ ] Backup automático do banco funcionando e testado (restauração ensaiada em ambiente de teste).
- [ ] Logs do backend acessíveis ao suporte técnico (não ao Alex) e monitoramento do webhook Pix por 7 dias após o deploy.
- [ ] `BILLING_AUTOMATION_NORMALIZED_DATES` **ausente/false** (bloqueios automáticos continuam como hoje; ativação é
      decisão futura, combinada com Alex).

## 2. Acesso do Alex
- [ ] Conta **pessoal** de Super Admin para o Alex (e-mail dele, senha definida por ele no primeiro acesso).
      As telas financeiras exigem Super Admin; não existe hoje um perfil "financeiro" com menos poderes.
- [ ] Alex entende que Super Admin também enxerga e altera dados de **todas** as empresas (cadastro, usuários, plano).
- [ ] Conta compartilhada antiga (se existir) desativada ou com senha trocada; cada pessoa com sua própria conta,
      para que a auditoria mostre quem fez cada ação.
- [ ] Segundo fator / boas práticas de senha combinados (senha forte, não reutilizada).
- [ ] Lista de quem mais é Super Admin revisada (Gestão SaaS → Super Admins) e reduzida ao necessário.

## 3. Credenciais sob custódia do Alex (sem registrar valores aqui)
- [ ] Acesso à conta Efí Pay da empresa (painel) — titularidade e recuperação de acesso no nome/e-mail corporativo.
- [ ] Certificado Efí e credenciais de API: **ficam no servidor**, gerenciados pela tela "Integração Efí" (Super Admin);
      Alex sabe onde ficam, mas não precisa manuseá-los no dia a dia. Qualquer troca segue o procedimento da fase 8.3-B2.
- [ ] Acesso à conta bancária/extratos usada para conferir pagamentos recebidos fora da Efí.
- [ ] Contato do suporte técnico para incidentes (nome, canal, horário).

## 4. Documentação entregue
- [ ] `GUIA-ALEX-FINANCEIRO.md` lido junto com Alex, com uma empresa de teste.
- [ ] Explicado o que **não** fazer (seção "Não faça" do guia).
- [ ] Explicada a diferença entre: pagamento atual, pagamento histórico, cortesia, renovação administrativa e ajuste de vencimento.

## 5. Treinamento prático (em TESTE, com empresas fictícias)
- [ ] Registrar pagamento atual (com prévia) e ver o vencimento mudar.
- [ ] Regularizar uma fatura antiga paga (data conhecida e data desconhecida) e confirmar que **não** renovou.
- [ ] Cancelar fatura indevida com justificativa.
- [ ] Registrar cortesia e conferir que não entrou na receita.
- [ ] Gerar fatura manual; ver a recusa de ciclo duplicado.
- [ ] Renovar administrativamente; ver a proteção contra clique duplo.
- [ ] Consultar linha do tempo e auditoria de uma empresa.
- [ ] Ler a simulação de bloqueios (somente leitura) e entender que nada é executado.
- [ ] Identificar itens de conciliação Efí e o que fazer com eles.

## 6. Regularização histórica (operacional, após o deploy em produção)
- [ ] Alex abre "Revisão de faturas históricas" e revisa empresa por empresa, uma fatura por vez.
- [ ] Para cada pagamento histórico: fonte da confirmação anotada (extrato, comprovante, registro próprio).
- [ ] Pix possivelmente perdidos durante o incidente tratados conforme HOMOLOGACAO.md §4.
- [ ] Ao final de cada dia de regularização: conferir os totais do painel financeiro com o controle do Alex.

## 7. Suporte e escalonamento
- [ ] Alex sabe quando **parar e chamar o suporte técnico**: erro inesperado repetido, valores que não batem,
      empresa que não desbloqueia após pagamento confirmado, item de conciliação de pagamento em duplicidade,
      qualquer pedido de alterar algo "direto no banco".
- [ ] O suporte técnico nunca altera dados financeiros direto no banco; correções são feitas pela interface, com auditoria.
- [ ] Canal e prazo de resposta combinados.

## 8. Aceite
- [ ] Alex executou o treinamento sem ajuda.
- [ ] Proprietário técnico e Alex assinam (data): ____________________
