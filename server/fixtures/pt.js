/**
 * Registo de demonstração em português (pt-PT).
 *
 * As fixtures existem por idioma para que a demonstração se leia naturalmente
 * na língua em que é apresentada. Os valores de vocabulário guardados (estado,
 * categoria, gravidade) permanecem em inglês em ambos os conjuntos - são dados
 * canónicos, traduzidos apenas na apresentação.
 */
import { dateBack, dateAhead } from './helpers.js';

export const THEMES = [
  {
    theme: {
      reference: 'RC-2026-001',
      title: 'Débitos diretos cobrados em duplicado após uma primeira apresentação falhada',
      description: 'Quando um débito direto falha na primeira apresentação, o processo de reapresentação volta a cobrar a mesma instrução no próprio dia. Os clientes veem duas deduções idênticas e entram em descoberto não autorizado. Os volumes subiram acentuadamente após a entrega de março no sistema de cobranças.',
      product: 'Personal Current Account', channel: 'Internet Banking', category: 'Debit Orders',
      severity: 'Critical', status: 'Remediation in progress',
      business_unit: 'Banca de Particulares e Private', product_owner: 'Thandeka Mokoena',
      product_owner_email: 'thandeka.mokoena@example.bank', complaint_manager: 'Sipho Ndlovu',
      first_reported_on: dateBack(17), last_reported_on: dateBack(1, 28),
      target_close_date: dateAhead(2), regulatory_risk: 1, watchlist: 1,
    },
    obs: { seed: 101, from: 46, to: 188, wobble: 0.16, resolutionFrom: 9, resolutionTo: 14, impactPerComplaint: 640, recorder: 'Sipho Ndlovu' },
    rootCauses: [
      { title: 'O processo de reapresentação não verifica o estado da cobrança original', description: 'O processamento noturno de reapresentação seleciona todas as instruções marcadas como "não pagas" sem excluir aquelas que já foram cobradas com sucesso no mesmo ciclo.', category: 'System / Technology', confidence: 'Confirmed', contribution_pct: 65, status: 'Being addressed', evidence: 'Defeito DEF-44219; reproduzido em pré-produção em 3 ciclos consecutivos.', identified_by: 'Nomsa Dlamini', identified_on: dateBack(6, 4) },
      { title: 'A anulação é manual e depende do escalamento pelo balcão', description: 'As cobranças duplicadas só são anuladas depois de um consultor registar o pedido, pelo que o cliente suporta o débito até 5 dias.', category: 'Process', confidence: 'Confirmed', contribution_pct: 25, status: 'Open', evidence: 'Levantamento do processo com as Operações de Cobrança, 14 casos analisados.', identified_by: 'Sipho Ndlovu', identified_on: dateBack(5, 19) },
      { title: 'Alteração do formato de ficheiro do banco patrocinador sem testes de regressão', description: 'O banco patrocinador alterou a estrutura dos códigos de motivo de não pagamento; assumiu-se que o mapeamento se mantinha.', category: 'Third party / Vendor', confidence: 'Under analysis', contribution_pct: 10, status: 'Open', evidence: 'Nota de alteração CN-2211 recebida depois da entrada em produção.', identified_by: 'Nomsa Dlamini', identified_on: dateBack(3, 8) },
    ],
    actions: [
      { title: 'Acrescentar uma verificação do estado de cobrança ao processo de reapresentação', description: 'Excluir as instruções com uma cobrança bem sucedida no ciclo atual antes de o ficheiro ser construído.', proposed_by: 'Thandeka Mokoena', proposer_role: 'Product owner', proposed_on: dateBack(6, 9), due_date: dateBack(1, 30), priority: 'Critical', status: 'In progress', effectiveness: 'Not assessed', notes: 'Em testes de sistema; entrega 26.9.', causeIndex: 0 },
      { title: 'Automatizar a anulação no próprio dia para duplicados confirmados', description: 'Anular automaticamente quando o montante, o mandato e a data coincidem com uma instrução já cobrada, com SMS ao cliente.', proposed_by: 'Thandeka Mokoena', proposer_role: 'Product owner', proposed_on: dateBack(5, 22), due_date: dateAhead(1), priority: 'High', status: 'Approved', effectiveness: 'Not assessed', notes: 'Financiada pelo orçamento de remediação de cobranças.', causeIndex: 1 },
      { title: 'Crédito proativo das comissões causadas pelos duplicados', description: 'Identificar as comissões de descoberto atribuíveis a um duplicado e creditá-las sem o cliente ter de pedir.', proposed_by: 'Sipho Ndlovu', proposer_role: 'Complaint manager', proposed_on: dateBack(4, 3), due_date: dateBack(2, 28), completed_on: dateBack(2, 25), priority: 'High', status: 'Completed', effectiveness: 'Effective', notes: 'R1,42m creditados em 2 211 contas; os contactos repetidos sobre este tema caíram no mês seguinte.', causeIndex: 1 },
      { title: 'Conjunto de testes de regressão para alterações de formato do patrocinador', description: 'Acrescentar testes de contrato do ficheiro do patrocinador ao controlo de entrega, para que uma alteração de estrutura faça falhar a compilação.', proposed_by: 'Lerato Khumalo', proposer_role: 'Technology lead', proposed_on: dateBack(3, 11), due_date: dateAhead(2), priority: 'Medium', status: 'Proposed', effectiveness: 'Not assessed', notes: 'A aguardar estimativa da equipa da plataforma de pagamentos.', causeIndex: 2 },
    ],
    incidents: [
      { incident_ref: 'INC-2026-0412', title: 'A reapresentação de cobranças correu duas vezes sobre o ciclo de março', description: 'Uma repetição após um processamento interrompido voltou a submeter o ficheiro completo. 18 400 contas foram debitadas em duplicado durante a noite.', severity: 'P1', status: 'Closed', started_at: dateBack(6, 2), resolved_at: dateBack(6, 3), systems_affected: 'Motor de Cobranças, Core Banking, Serviço de Notificações', customers_affected: 18400, postmortem_url: 'https://intranet.example.bank/pir/INC-2026-0412' },
      { incident_ref: 'INC-2026-0571', title: 'Acumulação na fila de anulações após o processamento automático de créditos', description: 'A fila de anulações manuais ultrapassou os 6 000 itens; o prazo de resposta subiu para 7 dias.', severity: 'P2', status: 'Resolved', started_at: dateBack(4, 8), resolved_at: dateBack(4, 15), systems_affected: 'Fluxo de trabalho das Operações de Cobrança', customers_affected: 6100, postmortem_url: '' },
    ],
    notes: [
      { note_type: 'Regulatory', body: 'O Provedor do Cliente Bancário abriu uma averiguação sistémica a 3 casos agrupados. O dossiê de resposta é devido em 30 dias; a Direção Jurídica e o Compliance foram informados.', author: 'Sipho Ndlovu' },
      { note_type: 'Meeting note', body: 'Fórum mensal de reclamações: o responsável de produto confirmou que a correção do processamento está em testes de sistema. O fórum concordou em manter este tema em acompanhamento até dois meses consecutivos de descida de volume.', author: 'Sipho Ndlovu' },
      { note_type: 'Customer feedback', body: 'Expressão recorrente nas cartas dos clientes: "o banco tirou-me o dinheiro duas vezes e tive de telefonar quatro vezes". O tom das reclamações está a agravar-se mesmo quando o dinheiro é devolvido.', author: 'Ayanda Peters' },
    ],
  },
  {
    theme: {
      reference: 'RC-2026-002',
      title: 'Cartões de substituição não entregues no prazo de 10 dias úteis',
      description: 'Os cartões de substituição e de renovação estão a chegar fora do prazo prometido de 10 dias úteis, sobretudo nas províncias fora das capitais. No balcão diz-se ao cliente que o cartão foi "expedido" quando ainda está na empresa de personalização.',
      product: 'Credit Card', channel: 'Branch', category: 'Card Delivery',
      severity: 'High', status: 'Monitoring',
      business_unit: 'Cartões e Pagamentos', product_owner: 'Rajesh Naidoo',
      product_owner_email: 'rajesh.naidoo@example.bank', complaint_manager: 'Sipho Ndlovu',
      first_reported_on: dateBack(17), last_reported_on: dateBack(1, 28),
      target_close_date: dateAhead(1), regulatory_risk: 0, watchlist: 1,
    },
    obs: { seed: 202, from: 134, to: 41, wobble: 0.14, resolutionFrom: 12, resolutionTo: 6, impactPerComplaint: 180, recorder: 'Ayanda Peters' },
    rootCauses: [
      { title: 'Falhas de cobertura da transportadora fora das capitais', description: 'O contrato da transportadora garante entrega no dia seguinte apenas nas capitais; os balcões mais periféricos são servidos por uma rota duas vezes por semana.', category: 'Third party / Vendor', confidence: 'Confirmed', contribution_pct: 55, status: 'Addressed', evidence: 'Anexo B do acordo de nível de serviço; dados de leitura de entrega de 6 meses.', identified_by: 'Rajesh Naidoo', identified_on: dateBack(12, 6) },
      { title: 'O estado do cartão mostrado aos consultores é a entrega à personalizadora, não a leitura da transportadora', description: 'O ecrã do balcão passa a "expedido" quando o ficheiro chega à personalizadora, pelo que os colaboradores prometem uma data que a transportadora não assumiu.', category: 'Customer communication', confidence: 'Confirmed', contribution_pct: 35, status: 'Addressed', evidence: 'Acompanhamento de ecrãs com 9 consultores; 22 chamadas gravadas analisadas.', identified_by: 'Ayanda Peters', identified_on: dateBack(11, 2) },
      { title: 'Os lotes de renovação em pico não foram distribuídos', description: 'A concentração de validades faz passar o triplo do volume normal pela personalizadora na primeira semana do mês.', category: 'Process', confidence: 'Confirmed', contribution_pct: 10, status: 'Addressed', evidence: 'Análise da capacidade de processamento da personalizadora.', identified_by: 'Rajesh Naidoo', identified_on: dateBack(10, 17) },
    ],
    actions: [
      { title: 'Contratar uma segunda transportadora para as províncias', description: 'Duplicar a fonte de entrega para que os balcões periféricos tenham uma rota diária.', proposed_by: 'Rajesh Naidoo', proposer_role: 'Product owner', proposed_on: dateBack(12, 10), due_date: dateBack(8, 30), completed_on: dateBack(8, 22), priority: 'High', status: 'Completed', effectiveness: 'Effective', notes: 'O tempo de entrega fora das capitais caiu de 14 para 7 dias em dois meses.', causeIndex: 0 },
      { title: 'Mostrar o estado real da transportadora no balcão e na aplicação', description: 'Apresentar o evento de leitura da transportadora em vez da entrega à personalizadora, com SMS na expedição.', proposed_by: 'Rajesh Naidoo', proposer_role: 'Product owner', proposed_on: dateBack(11, 5), due_date: dateBack(6, 28), completed_on: dateBack(6, 19), priority: 'High', status: 'Completed', effectiveness: 'Effective', notes: 'O volume de chamadas "onde está o meu cartão" caiu cerca de um terço.', causeIndex: 1 },
      { title: 'Distribuir os lotes de renovação ao longo do mês', description: 'Repartir as reemissões por validade em quatro processamentos semanais.', proposed_by: 'Naledi Mahlangu', proposer_role: 'Operations lead', proposed_on: dateBack(10, 20), due_date: dateBack(7, 31), completed_on: dateBack(7, 29), priority: 'Medium', status: 'Completed', effectiveness: 'Partially effective', notes: 'Ajudou a personalizadora, mas os picos de início de mês ainda se veem.', causeIndex: 2 },
      { title: 'Manter a monitorização mensal até os volumes ficarem abaixo de 45', description: 'Encerrar o tema apenas após três meses consecutivos abaixo do limiar.', proposed_by: 'Sipho Ndlovu', proposer_role: 'Complaint manager', proposed_on: dateBack(5, 6), due_date: dateAhead(1), priority: 'Low', status: 'In progress', effectiveness: 'Not assessed', notes: 'Dois meses abaixo do limiar até agora.', causeIndex: null },
    ],
    incidents: [
      { incident_ref: 'INC-2025-3388', title: 'Paragem da personalizadora de cartões durante 36 horas', description: 'Uma avaria de impressora parou toda a produção de cartões durante um fim de semana, criando uma acumulação de 9 000 cartões.', severity: 'P2', status: 'Closed', started_at: dateBack(13, 7), resolved_at: dateBack(13, 9), systems_affected: 'Personalizadora de cartões', customers_affected: 9000, postmortem_url: 'https://intranet.example.bank/pir/INC-2025-3388' },
    ],
    notes: [
      { note_type: 'Decision', body: 'O fórum de reclamações concordou em passar este tema de "Correção em curso" para "Em monitorização". A tendência desceu 69% face aos seis meses anteriores e ambas as causas confirmadas estão tratadas.', author: 'Sipho Ndlovu' },
      { note_type: 'Observation', body: 'As reclamações residuais concentram-se em três balcões que continuam a usar o texto antigo de expedição nos seus modelos de SMS. Assunto levantado junto das operações regionais.', author: 'Ayanda Peters' },
    ],
  },
  {
    theme: {
      reference: 'RC-2026-003',
      title: 'A autenticação na aplicação falha após novo registo biométrico num equipamento novo',
      description: 'Os clientes que voltam a registar a biometria num telemóvel de substituição ficam bloqueados no segundo passo de autenticação e têm de telefonar para o centro de contacto para uma reposição manual. O ecrã alternativo de código fica em ciclo sem mostrar erro.',
      product: 'Digital Banking', channel: 'Mobile App', category: 'Account Access',
      severity: 'High', status: 'Action plan agreed',
      business_unit: 'Digital e Comércio Eletrónico', product_owner: 'Farhaan Ismail',
      product_owner_email: 'farhaan.ismail@example.bank', complaint_manager: 'Zanele Mthembu',
      first_reported_on: dateBack(11), last_reported_on: dateBack(1, 28),
      target_close_date: dateAhead(3), regulatory_risk: 0, watchlist: 1,
    },
    obs: { seed: 303, from: 22, to: 96, wobble: 0.2, resolutionFrom: 3, resolutionTo: 5, impactPerComplaint: 90, recorder: 'Zanele Mthembu' },
    rootCauses: [
      { title: 'A chave de associação do equipamento não é invalidada quando a biometria é registada de novo', description: 'A chave do equipamento antigo permanece ativa, pelo que o motor de risco vê duas associações concorrentes e falha silenciosamente o passo de reforço.', category: 'System / Technology', confidence: 'Confirmed', contribution_pct: 70, status: 'Being addressed', evidence: 'Registos do serviço de autenticação em 40 perfis afetados.', identified_by: 'Farhaan Ismail', identified_on: dateBack(4, 15) },
      { title: 'O ecrã alternativo não tem estado de erro', description: 'Quando o passo de reforço falha, a aplicação volta a apresentar o ecrã de código em vez de explicar a falha ou oferecer uma reposição autónoma.', category: 'Customer communication', confidence: 'Confirmed', contribution_pct: 30, status: 'Open', evidence: 'Revisão de usabilidade; 12 sessões gravadas.', identified_by: 'Zanele Mthembu', identified_on: dateBack(3, 21) },
    ],
    actions: [
      { title: 'Invalidar associações de equipamento obsoletas no novo registo', description: 'Revogar as chaves de equipamentos anteriores quando um novo registo biométrico é concluído.', proposed_by: 'Farhaan Ismail', proposer_role: 'Product owner', proposed_on: dateBack(4, 18), due_date: dateAhead(1), priority: 'Critical', status: 'Approved', effectiveness: 'Not assessed', notes: 'Revisão de segurança aprovada; agendado para a versão 26.10 da aplicação.', causeIndex: 0 },
      { title: 'Criar um percurso de desbloqueio autónomo com um estado de erro claro', description: 'Substituir o ciclo silencioso por uma explicação e um caminho de reposição dentro da aplicação.', proposed_by: 'Farhaan Ismail', proposer_role: 'Product owner', proposed_on: dateBack(3, 25), due_date: dateAhead(2), priority: 'High', status: 'Proposed', effectiveness: 'Not assessed', notes: 'Desenho pronto; a aguardar priorização no comité de portefólio digital.', causeIndex: 1 },
      { title: 'Guião provisório e reposição rápida no centro de contacto', description: 'Dar aos assistentes uma reposição num único passo, para que os clientes não sejam transferidos.', proposed_by: 'Zanele Mthembu', proposer_role: 'Complaint manager', proposed_on: dateBack(3, 2), due_date: dateBack(2, 14), completed_on: dateBack(2, 11), priority: 'Medium', status: 'Completed', effectiveness: 'Partially effective', notes: 'O tempo de atendimento melhorou, mas o volume de chamadas não desceu.', causeIndex: 1 },
    ],
    incidents: [
      { incident_ref: 'INC-2026-0733', title: 'Degradação do serviço de autenticação após entrega do motor de risco', description: 'A latência da autenticação reforçada subiu acima dos 8 segundos, fazendo expirar os registos biométricos.', severity: 'P2', status: 'Resolved', started_at: dateBack(3, 6), resolved_at: dateBack(3, 6), systems_affected: 'Serviço de Autenticação, Motor de Risco', customers_affected: 14200, postmortem_url: 'https://intranet.example.bank/pir/INC-2026-0733' },
    ],
    notes: [
      { note_type: 'Escalation', body: 'É a tendência mais acentuada do registo: uma subida de 118% face aos seis períodos anteriores. Escalado ao comité de portefólio digital para conseguir financiamento do percurso de desbloqueio ainda neste trimestre e não no próximo.', author: 'Zanele Mthembu' },
      { note_type: 'Customer feedback', body: 'As avaliações nas lojas de aplicações que mencionam "não consigo entrar depois de mudar de telemóvel" triplicaram desde abril. A escuta de redes sociais registou a mesma expressão.', author: 'Ayanda Peters' },
    ],
  },
  {
    theme: {
      reference: 'RC-2026-004',
      title: 'Comissões mensais inesperadas após a alteração do pacote de preçário',
      description: 'Os clientes migrados para o novo preçário em pacote estão a ser cobrados por operações que julgavam estar incluídas. A carta enviada antes da migração não detalhou quais as operações que ficam fora do pacote.',
      product: 'Personal Current Account', channel: 'Call Centre', category: 'Fees & Charges',
      severity: 'High', status: 'Remediation in progress',
      business_unit: 'Banca de Particulares e Private', product_owner: 'Michelle van Wyk',
      product_owner_email: 'michelle.vanwyk@example.bank', complaint_manager: 'Sipho Ndlovu',
      first_reported_on: dateBack(9), last_reported_on: dateBack(1, 28),
      target_close_date: dateAhead(2), regulatory_risk: 1, watchlist: 0,
    },
    obs: { seed: 404, from: 58, to: 112, wobble: 0.17, resolutionFrom: 6, resolutionTo: 8, impactPerComplaint: 310, recorder: 'Sipho Ndlovu' },
    rootCauses: [
      { title: 'A carta de migração omitiu a lista de operações fora do pacote', description: 'A comunicação descrevia as vantagens do pacote mas não as exclusões, pelo que os clientes formaram uma expectativa razoável mas errada.', category: 'Customer communication', confidence: 'Confirmed', contribution_pct: 50, status: 'Being addressed', evidence: 'Modelo de carta PRC-114 comparado com o guia de preçário.', identified_by: 'Michelle van Wyk', identified_on: dateBack(7, 9) },
      { title: 'A descrição da comissão no extrato não está em linguagem clara', description: 'As linhas do extrato aparecem como códigos internos de comissão, pelo que o cliente não consegue perceber o que lhe foi cobrado.', category: 'Policy & Product design', confidence: 'Confirmed', contribution_pct: 30, status: 'Open', evidence: 'Revisão de linguagem clara; 30 extratos analisados.', identified_by: 'Ayanda Peters', identified_on: dateBack(6, 14) },
      { title: 'Algumas contas foram migradas para o escalão de pacote errado', description: 'Uma regra de mapeamento colocou contas de baixo volume no escalão intermédio.', category: 'Data quality', confidence: 'Confirmed', contribution_pct: 20, status: 'Addressed', evidence: 'Reconciliação da migração: 4 780 contas no escalão errado.', identified_by: 'Michelle van Wyk', identified_on: dateBack(5, 3) },
    ],
    actions: [
      { title: 'Reenviar a comunicação de preçário com a lista de exclusões', description: 'Enviar um seguimento em linguagem clara que nomeie todos os tipos de operação fora do pacote.', proposed_by: 'Michelle van Wyk', proposer_role: 'Product owner', proposed_on: dateBack(7, 12), due_date: dateBack(3, 30), completed_on: dateBack(3, 27), priority: 'High', status: 'Completed', effectiveness: 'Partially effective', notes: 'O crescimento das reclamações abrandou mas não inverteu.', causeIndex: 0 },
      { title: 'Reescrever as descrições de comissões do extrato em linguagem clara', description: 'Substituir os códigos de comissão por descrições legíveis pelo cliente no extrato e na aplicação.', proposed_by: 'Michelle van Wyk', proposer_role: 'Product owner', proposed_on: dateBack(6, 18), due_date: dateAhead(2), priority: 'High', status: 'In progress', effectiveness: 'Not assessed', notes: 'A alteração na plataforma de extratos é o caminho crítico.', causeIndex: 1 },
      { title: 'Corrigir as contas mal escalonadas e devolver a diferença', description: 'Reposicionar as 4 780 contas e devolver as comissões cobradas desde a migração.', proposed_by: 'Michelle van Wyk', proposer_role: 'Product owner', proposed_on: dateBack(5, 6), due_date: dateBack(4, 30), completed_on: dateBack(4, 28), priority: 'Critical', status: 'Completed', effectiveness: 'Effective', notes: 'R2,1m devolvidos; sem reclamações repetidas deste grupo.', causeIndex: 2 },
      { title: 'Acrescentar uma explicação da comissão no detalhe da operação na aplicação', description: 'Tocar numa comissão para ver a que se refere e se o pacote a cobre.', proposed_by: 'Farhaan Ismail', proposer_role: 'Product owner', proposed_on: dateBack(2, 9), due_date: dateAhead(3), priority: 'Medium', status: 'Blocked', effectiveness: 'Not assessed', notes: 'Bloqueada até que o trabalho das descrições do extrato fique concluído.', causeIndex: 1 },
    ],
    incidents: [],
    notes: [
      { note_type: 'Regulatory', body: 'Dois casos remetidos pelo Provedor, ambos julgados procedentes por motivos de comunicação e não pela comissão em si. O risco de conduta pediu o plano de remediação até ao fim do mês.', author: 'Sipho Ndlovu' },
      { note_type: 'Meeting note', body: 'O comité de preçário confirmou que não haverá alteração ao pacote. A posição acordada é que as comissões estão corretas mas não foram adequadamente divulgadas, pelo que a remediação se concentra na comunicação e na devolução ao grupo mal escalonado.', author: 'Michelle van Wyk' },
    ],
  },
  {
    theme: {
      reference: 'RC-2026-005',
      title: 'Ausência de informação proativa sobre o andamento do crédito habitação',
      description: 'Os requerentes não recebem qualquer informação entre a submissão e a aprovação e têm de insistir para obter novidades. A maioria das reclamações é sobre o silêncio e não sobre a decisão.',
      product: 'Home Loans', channel: 'Call Centre', category: 'Service & Turnaround',
      severity: 'Medium', status: 'Remediation in progress',
      business_unit: 'Serviços de Habitação', product_owner: 'Gugu Sithole',
      product_owner_email: 'gugu.sithole@example.bank', complaint_manager: 'Zanele Mthembu',
      first_reported_on: dateBack(16), last_reported_on: dateBack(1, 28),
      target_close_date: dateAhead(4), regulatory_risk: 0, watchlist: 0,
    },
    obs: { seed: 505, from: 71, to: 64, wobble: 0.15, resolutionFrom: 11, resolutionTo: 9, impactPerComplaint: 120, recorder: 'Zanele Mthembu' },
    rootCauses: [
      { title: 'Não há notificação de estado entre a submissão e a decisão', description: 'O percurso envia um aviso de receção e uma decisão, sem nada nos 5 a 15 dias intermédios.', category: 'Process', confidence: 'Confirmed', contribution_pct: 60, status: 'Being addressed', evidence: 'Mapa do percurso; auditoria aos eventos de notificação.', identified_by: 'Gugu Sithole', identified_on: dateBack(9, 11) },
      { title: 'Os consultores não conseguem ver a posição na fila de avaliação', description: 'O atendimento só consegue dizer "está no crédito", o que soa a desculpa.', category: 'System / Technology', confidence: 'Confirmed', contribution_pct: 25, status: 'Open', evidence: 'Auditoria aos ecrãs do centro de contacto.', identified_by: 'Zanele Mthembu', identified_on: dateBack(8, 5) },
      { title: 'Os documentos são pedidos em sequência e não de uma só vez', description: 'Cada documento em falta reinicia o prazo e desencadeia mais uma espera silenciosa.', category: 'Process', confidence: 'Under analysis', contribution_pct: 15, status: 'Open', evidence: '35 processos analisados; em média 2,4 pedidos de documentos por processo.', identified_by: 'Gugu Sithole', identified_on: dateBack(4, 22) },
    ],
    actions: [
      { title: 'SMS e email a cada mudança de fase', description: 'Notificar na receção, na marcação da avaliação, no início da análise e na decisão.', proposed_by: 'Gugu Sithole', proposer_role: 'Product owner', proposed_on: dateBack(9, 15), due_date: dateBack(1, 30), completed_on: dateBack(1, 26), priority: 'High', status: 'Completed', effectiveness: 'Too early to tell', notes: 'Em produção desde o mês passado; a observar os próximos dois períodos de monitorização.', causeIndex: 0 },
      { title: 'Mostrar a posição na fila aos consultores do centro de contacto', description: 'Acrescentar a posição na fila de avaliação e a data prevista ao ecrã de atendimento.', proposed_by: 'Gugu Sithole', proposer_role: 'Product owner', proposed_on: dateBack(8, 9), due_date: dateAhead(2), priority: 'Medium', status: 'In progress', effectiveness: 'Not assessed', notes: 'Integração com o fluxo de crédito em construção.', causeIndex: 1 },
      { title: 'Lista única de documentos pedida à partida', description: 'Pedir todos os documentos prováveis no momento do pedido em vez de em sequência.', proposed_by: 'Gugu Sithole', proposer_role: 'Product owner', proposed_on: dateBack(4, 26), due_date: dateAhead(4), priority: 'Medium', status: 'Proposed', effectiveness: 'Not assessed', notes: 'Necessita de aprovação da política de crédito.', causeIndex: 2 },
    ],
    incidents: [],
    notes: [
      { note_type: 'Observation', body: 'Os volumes estão estáveis e não a descer. As notificações por fase só entraram em produção no mês passado, pelo que os próximos dois períodos de monitorização dirão se a ação principal resultou.', author: 'Zanele Mthembu' },
    ],
  },
  {
    theme: {
      reference: 'RC-2026-006',
      title: 'Operações de cartão contestadas a demorar mais de 45 dias a resolver',
      description: 'Os processos de contestação ultrapassam o prazo divulgado de 45 dias, com os clientes privados do dinheiro enquanto o processo decorre. Os casos com comerciantes internacionais são os mais afetados.',
      product: 'Credit Card', channel: 'Call Centre', category: 'Fraud & Disputes',
      severity: 'Critical', status: 'Under investigation',
      business_unit: 'Cartões e Pagamentos', product_owner: 'Rajesh Naidoo',
      product_owner_email: 'rajesh.naidoo@example.bank', complaint_manager: 'Sipho Ndlovu',
      first_reported_on: dateBack(14), last_reported_on: dateBack(1, 28),
      target_close_date: dateAhead(3), regulatory_risk: 1, watchlist: 1,
    },
    obs: { seed: 606, from: 63, to: 129, wobble: 0.18, resolutionFrom: 38, resolutionTo: 52, impactPerComplaint: 1450, recorder: 'Sipho Ndlovu' },
    rootCauses: [
      { title: 'O número de processos por analista duplicou', description: 'O dimensionamento da equipa foi feito para volumes anteriores ao crescimento; os processos esperam agora 11 dias até à primeira análise.', category: 'People & Training', confidence: 'Confirmed', contribution_pct: 45, status: 'Open', evidence: 'Modelo de dimensionamento face à entrada real, 12 meses.', identified_by: 'Naledi Mahlangu', identified_on: dateBack(6, 7) },
      { title: 'As respostas das redes de pagamento são tratadas manualmente', description: 'Cada mensagem da rede é reintroduzida à mão no sistema de processos, acrescentando 3 a 4 dias por troca.', category: 'Process', confidence: 'Confirmed', contribution_pct: 35, status: 'Open', evidence: 'Estudo de tempos e movimentos em 60 processos.', identified_by: 'Rajesh Naidoo', identified_on: dateBack(5, 16) },
      { title: 'O crédito provisório não é aplicado de forma consistente', description: 'Se o cliente recebe ou não um crédito temporário depende do analista, pelo que casos semelhantes são tratados de forma diferente.', category: 'Policy & Product design', confidence: 'Confirmed', contribution_pct: 20, status: 'Open', evidence: 'Revisão de consistência em 50 processos; 19 divergências.', identified_by: 'Sipho Ndlovu', identified_on: dateBack(3, 19) },
    ],
    actions: [
      { title: 'Reforçar com 12 analistas de contestações e qualificar a equipa de fraude', description: 'Trazer o tempo até à primeira análise para menos de 3 dias.', proposed_by: 'Rajesh Naidoo', proposer_role: 'Product owner', proposed_on: dateBack(6, 12), due_date: dateAhead(1), priority: 'Critical', status: 'Approved', effectiveness: 'Not assessed', notes: 'Recrutamento aprovado; 5 dos 12 lugares preenchidos.', causeIndex: 0 },
      { title: 'Automatizar a receção das respostas das redes de pagamento', description: 'Integrar as mensagens da rede diretamente no sistema de processos em vez de as reintroduzir.', proposed_by: 'Lerato Khumalo', proposer_role: 'Technology lead', proposed_on: dateBack(5, 20), due_date: dateAhead(3), priority: 'High', status: 'In progress', effectiveness: 'Not assessed', notes: 'Ambiente de testes da rede ligado; mapeamento em construção.', causeIndex: 1 },
      { title: 'Crédito provisório obrigatório abaixo de um limiar definido', description: 'Creditar automaticamente as contestações abaixo do limiar em 2 dias, na pendência da investigação.', proposed_by: 'Rajesh Naidoo', proposer_role: 'Product owner', proposed_on: dateBack(3, 23), due_date: dateAhead(2), priority: 'High', status: 'Blocked', effectiveness: 'Not assessed', notes: 'Bloqueada a aguardar a modelação de perdas de crédito pela Direção de Risco.', causeIndex: 2 },
      { title: 'Relatório semanal de antiguidade para o responsável de produto e o fórum', description: 'Publicar os processos com mais de 30 dias para que a antiguidade seja visível antes de ultrapassar o prazo.', proposed_by: 'Sipho Ndlovu', proposer_role: 'Complaint manager', proposed_on: dateBack(4, 4), due_date: dateBack(3, 29), completed_on: dateBack(3, 26), priority: 'Medium', status: 'Completed', effectiveness: 'Partially effective', notes: 'A visibilidade melhorou; a fila em si não muda sem capacidade.', causeIndex: 0 },
    ],
    incidents: [
      { incident_ref: 'INC-2026-0899', title: 'Sistema de processos de contestação indisponível durante 2 dias após migração de base de dados', description: 'O trabalho sobre os processos parou por completo; a acumulação demorou três semanas a resolver.', severity: 'P1', status: 'Closed', started_at: dateBack(5, 11), resolved_at: dateBack(5, 13), systems_affected: 'Gestão de Processos de Contestação, Gateway das Redes', customers_affected: 7300, postmortem_url: 'https://intranet.example.bank/pir/INC-2026-0899' },
      { incident_ref: 'INC-2026-1024', title: 'A expiração de um certificado no gateway das redes bloqueou os envios', description: 'As mensagens de saída para as redes falharam durante 19 horas, envelhecendo silenciosamente 1 200 processos.', severity: 'P2', status: 'Closed', started_at: dateBack(2, 17), resolved_at: dateBack(2, 18), systems_affected: 'Gateway das Redes de Pagamento', customers_affected: 1200, postmortem_url: '' },
    ],
    notes: [
      { note_type: 'Escalation', body: 'Este tema tem o maior impacto financeiro do registo e é a origem mais provável de uma constatação sistémica. Ambos os incidentes acima fizeram subir os volumes no mês seguinte, o que é visível no histórico de monitorização.', author: 'Sipho Ndlovu' },
      { note_type: 'Decision', body: 'Decisão do fórum: não encerrar a ação do crédito provisório como rejeitada. Mantém-se bloqueada até a Direção de Risco entregar o modelo de perdas, e o bloqueio é reportado mensalmente à comissão executiva.', author: 'Sipho Ndlovu' },
    ],
  },
  {
    theme: {
      reference: 'RC-2026-007',
      title: 'Pagamentos imediatos a falhar na janela diária de fecho',
      description: 'Os pagamentos em tempo real submetidos entre as 23h40 e as 00h20 falham com um erro genérico mas continuam a cativar os fundos, pelo que os clientes veem o dinheiro sair sem que o beneficiário seja pago.',
      product: 'Digital Banking', channel: 'Mobile App', category: 'Payments & Transfers',
      severity: 'High', status: 'Action plan agreed',
      business_unit: 'Digital e Comércio Eletrónico', product_owner: 'Farhaan Ismail',
      product_owner_email: 'farhaan.ismail@example.bank', complaint_manager: 'Zanele Mthembu',
      first_reported_on: dateBack(8), last_reported_on: dateBack(1, 28),
      target_close_date: dateAhead(2), regulatory_risk: 0, watchlist: 1,
    },
    obs: { seed: 707, from: 19, to: 57, wobble: 0.22, resolutionFrom: 4, resolutionTo: 6, impactPerComplaint: 260, recorder: 'Zanele Mthembu' },
    rootCauses: [
      { title: 'A cativação de fundos não é libertada quando o fecho rejeita o pagamento', description: 'A cativação e a instrução de pagamento são confirmadas separadamente; uma rejeição no fecho anula apenas a instrução.', category: 'System / Technology', confidence: 'Confirmed', contribution_pct: 75, status: 'Being addressed', evidence: 'Rastreio de transações em 3 janelas de fecho.', identified_by: 'Lerato Khumalo', identified_on: dateBack(3, 13) },
      { title: 'A mensagem de erro genérica não dá ao cliente nada sobre que agir', description: '"Não foi possível processar o pagamento" não diz que o dinheiro será devolvido nem quando.', category: 'Customer communication', confidence: 'Confirmed', contribution_pct: 25, status: 'Open', evidence: 'Revisão do catálogo de erros.', identified_by: 'Zanele Mthembu', identified_on: dateBack(2, 20) },
    ],
    actions: [
      { title: 'Tornar a cativação e a instrução uma única operação atómica', description: 'Libertar a cativação na mesma transação que rejeita a instrução.', proposed_by: 'Farhaan Ismail', proposer_role: 'Product owner', proposed_on: dateBack(3, 16), due_date: dateAhead(1), priority: 'Critical', status: 'In progress', effectiveness: 'Not assessed', notes: 'Correção construída; a aguardar uma janela de fecho para entrar em produção.', causeIndex: 0 },
      { title: 'Bloquear a submissão de pagamentos imediatos durante a janela de fecho', description: 'Salvaguarda provisória: mostrar uma mensagem clara de "tente novamente após as 00h20" em vez de falhar.', proposed_by: 'Farhaan Ismail', proposer_role: 'Product owner', proposed_on: dateBack(3, 16), due_date: dateBack(2, 28), completed_on: dateBack(2, 24), priority: 'High', status: 'Completed', effectiveness: 'Effective', notes: 'Reduziu as falhas na janela em cerca de 80% enquanto a correção definitiva é construída.', causeIndex: 0 },
      { title: 'Reescrever as mensagens de falha de pagamento com passos seguintes e prazos', description: 'Dizer o que aconteceu, quando o dinheiro volta e o que fazer a seguir.', proposed_by: 'Zanele Mthembu', proposer_role: 'Complaint manager', proposed_on: dateBack(2, 24), due_date: dateAhead(2), priority: 'Medium', status: 'Approved', effectiveness: 'Not assessed', notes: 'Texto aprovado pela Direção Jurídica e pela Conduta.', causeIndex: 1 },
    ],
    incidents: [
      { incident_ref: 'INC-2026-0967', title: 'Fecho prolongado após uma correção no core banking', description: 'A janela de fecho durou 70 minutos em vez de 40, alargando a janela de falha.', severity: 'P2', status: 'Closed', started_at: dateBack(4, 2), resolved_at: dateBack(4, 2), systems_affected: 'Core Banking, Gateway de Pagamentos Imediatos', customers_affected: 2400, postmortem_url: 'https://intranet.example.bank/pir/INC-2026-0967' },
    ],
    notes: [
      { note_type: 'Observation', body: 'A salvaguarda provisória está a conter os volumes, mas o defeito de fundo na cativação continua em aberto. Se a entrada em produção ultrapassar a data-alvo, este tema deve voltar a "Correção em curso".', author: 'Zanele Mthembu' },
    ],
  },
  {
    theme: {
      reference: 'RC-2026-008',
      title: 'Diferenças de numerário em caixas automáticas não anuladas automaticamente',
      description: 'Quando uma caixa automática entrega menos do que o montante pedido, a diferença só é creditada depois de o cliente reclamar e de o centro de numerário reconciliar o equipamento, normalmente 5 a 8 dias depois.',
      product: 'Personal Current Account', channel: 'ATM', category: 'System Availability',
      severity: 'Medium', status: 'Monitoring',
      business_unit: 'Operações de Canais', product_owner: 'Naledi Mahlangu',
      product_owner_email: 'naledi.mahlangu@example.bank', complaint_manager: 'Sipho Ndlovu',
      first_reported_on: dateBack(17), last_reported_on: dateBack(1, 28),
      target_close_date: dateAhead(1), regulatory_risk: 0, watchlist: 0,
    },
    obs: { seed: 808, from: 88, to: 37, wobble: 0.16, resolutionFrom: 8, resolutionTo: 4, impactPerComplaint: 540, recorder: 'Ayanda Peters' },
    rootCauses: [
      { title: 'A anulação espera pela reconciliação física do numerário', description: 'O crédito só é lançado depois de o centro de numerário contar o equipamento, mesmo quando o registo de entrega é inequívoco.', category: 'Process', confidence: 'Confirmed', contribution_pct: 70, status: 'Addressed', evidence: 'Revisão do processo do centro de numerário.', identified_by: 'Naledi Mahlangu', identified_on: dateBack(12, 4) },
      { title: 'O parque de equipamentos mais antigo regista entregas parciais de forma inconsistente', description: 'As unidades anteriores a 2019 registam uma entrega parcial como sucesso, pelo que não é levantada qualquer exceção.', category: 'System / Technology', confidence: 'Confirmed', contribution_pct: 30, status: 'Being addressed', evidence: 'Auditoria ao firmware de todo o parque de equipamentos.', identified_by: 'Lerato Khumalo', identified_on: dateBack(10, 9) },
    ],
    actions: [
      { title: 'Creditar automaticamente quando o registo de entrega confirma a diferença', description: 'Creditar em 24 horas com base no registo do equipamento e reconciliar depois.', proposed_by: 'Naledi Mahlangu', proposer_role: 'Product owner', proposed_on: dateBack(12, 8), due_date: dateBack(6, 30), completed_on: dateBack(6, 24), priority: 'High', status: 'Completed', effectiveness: 'Effective', notes: 'O tempo médio de resolução caiu de 8 para 4 dias; o volume de reclamações caiu para menos de metade.', causeIndex: 0 },
      { title: 'Atualização de firmware do parque de equipamentos anterior a 2019', description: 'Distribuir o firmware que levanta uma exceção de entrega parcial.', proposed_by: 'Lerato Khumalo', proposer_role: 'Technology lead', proposed_on: dateBack(10, 13), due_date: dateAhead(1), priority: 'Medium', status: 'In progress', effectiveness: 'Not assessed', notes: '61% do parque atualizado.', causeIndex: 1 },
    ],
    incidents: [
      { incident_ref: 'INC-2025-3901', title: 'Acumulação na reconciliação do centro de numerário no período festivo', description: 'A reconciliação ficou 11 dias em atraso, atrasando todos os créditos de diferenças.', severity: 'P3', status: 'Closed', started_at: dateBack(9, 27), resolved_at: dateBack(8, 9), systems_affected: 'Reconciliação do centro de numerário', customers_affected: 3100, postmortem_url: '' },
    ],
    notes: [
      { note_type: 'Observation', body: 'As reclamações restantes correspondem quase exatamente aos balcões que ainda têm equipamentos por atualizar. É de esperar que este tema possa ser encerrado quando a distribuição do firmware terminar.', author: 'Ayanda Peters' },
    ],
  },
  {
    theme: {
      reference: 'RC-2026-009',
      title: 'Operações em falta nos extratos após a migração da plataforma de dados',
      description: 'Os extratos gerados após a migração não contêm as operações de ponto de venda do fim de semana da migração. Os saldos estão corretos mas o extrato não reconcilia, o que afeta os clientes que entregam extratos em pedidos de crédito.',
      product: 'Digital Banking', channel: 'Internet Banking', category: 'Statements & Reporting',
      severity: 'High', status: 'Reopened',
      business_unit: 'Dados e Análise', product_owner: 'Lerato Khumalo',
      product_owner_email: 'lerato.khumalo@example.bank', complaint_manager: 'Zanele Mthembu',
      first_reported_on: dateBack(7), last_reported_on: dateBack(1, 28),
      target_close_date: dateAhead(2), regulatory_risk: 1, watchlist: 1,
    },
    obs: { seed: 909, from: 31, to: 44, wobble: 0.3, resolutionFrom: 7, resolutionTo: 10, impactPerComplaint: 210, recorder: 'Zanele Mthembu' },
    rootCauses: [
      { title: 'A transição da migração perdeu registos de ponto de venda em trânsito', description: 'Os registos escritos durante a janela de transição não ficaram nem no repositório antigo nem no novo.', category: 'Data quality', confidence: 'Confirmed', contribution_pct: 80, status: 'Being addressed', evidence: 'A reconciliação encontrou 214 000 registos órfãos.', identified_by: 'Lerato Khumalo', identified_on: dateBack(6, 21) },
      { title: 'Não havia controlo de reconciliação antes de os extratos serem disponibilizados', description: 'Os extratos foram gerados a partir do novo repositório sem uma verificação de contagem face à origem.', category: 'Process', confidence: 'Confirmed', contribution_pct: 20, status: 'Open', evidence: 'O manual da migração não tem um passo de reconciliação.', identified_by: 'Zanele Mthembu', identified_on: dateBack(5, 8) },
    ],
    actions: [
      { title: 'Recuperar os registos órfãos e reemitir os extratos afetados', description: 'Recuperar a partir do sistema de origem, carregar e depois regerar e reemitir os extratos.', proposed_by: 'Lerato Khumalo', proposer_role: 'Product owner', proposed_on: dateBack(6, 24), due_date: dateBack(3, 31), completed_on: dateBack(3, 28), priority: 'Critical', status: 'Completed', effectiveness: 'Partially effective', notes: 'A primeira recuperação não abrangeu os registos de fevereiro, razão pela qual o tema foi reaberto.', causeIndex: 0 },
      { title: 'Segunda passagem de recuperação abrangendo fevereiro', description: 'Repetir a recuperação para o período que a primeira passagem não abrangeu.', proposed_by: 'Lerato Khumalo', proposer_role: 'Product owner', proposed_on: dateBack(1, 12), due_date: dateAhead(1), priority: 'Critical', status: 'In progress', effectiveness: 'Not assessed', notes: 'Definida após a reabertura; contagens de reconciliação acordadas com a Direção Financeira.', causeIndex: 0 },
      { title: 'Tornar a reconciliação um controlo obrigatório no manual de migração', description: 'Nenhum extrato é disponibilizado sem uma correspondência de contagem e de valor entre origem e destino.', proposed_by: 'Lerato Khumalo', proposer_role: 'Product owner', proposed_on: dateBack(5, 12), due_date: dateAhead(2), priority: 'High', status: 'Approved', effectiveness: 'Not assessed', notes: 'A Gestão de Alterações concordou em tornar isto um controlo de entrega.', causeIndex: 1 },
    ],
    incidents: [
      { incident_ref: 'INC-2026-0810', title: 'A transição da migração da plataforma de dados excedeu a janela', description: 'A janela de migração excedeu em 5 horas com a escrita dupla desativada, perdendo registos em trânsito.', severity: 'P1', status: 'Closed', started_at: dateBack(7, 15), resolved_at: dateBack(7, 16), systems_affected: 'Plataforma de Dados, Geração de Extratos', customers_affected: 214000, postmortem_url: 'https://intranet.example.bank/pir/INC-2026-0810' },
    ],
    notes: [
      { note_type: 'Decision', body: 'Tema reaberto no mês passado. A primeira recuperação foi dada como concluída mas não abrangeu fevereiro, e as reclamações regressaram em duas semanas. O encerramento exige agora uma reconciliação assinada pela Direção Financeira e não apenas a ação marcada como concluída.', author: 'Zanele Mthembu' },
      { note_type: 'Regulatory', body: 'A exatidão dos extratos é uma matéria de integridade de dados sujeita a reporte. O Compliance foi notificado; será exigido um relatório formal se a segunda recuperação não reconciliar.', author: 'Sipho Ndlovu' },
    ],
  },
  {
    theme: {
      reference: 'RC-2026-010',
      title: 'Cálculos de liquidação de financiamento automóvel a demorar mais de 5 dias úteis',
      description: 'Os clientes que liquidam ou refinanciam uma viatura esperam mais de uma semana por um cálculo de liquidação, e o cálculo caduca muitas vezes antes de poderem agir sobre ele.',
      product: 'Vehicle & Asset Finance', channel: 'Call Centre', category: 'Service & Turnaround',
      severity: 'Medium', status: 'Under investigation',
      business_unit: 'Financiamento Automóvel e de Bens', product_owner: 'Pieter Coetzee',
      product_owner_email: 'pieter.coetzee@example.bank', complaint_manager: 'Sipho Ndlovu',
      first_reported_on: dateBack(10), last_reported_on: dateBack(1, 28),
      target_close_date: dateAhead(4), regulatory_risk: 0, watchlist: 0,
    },
    obs: { seed: 1010, from: 27, to: 49, wobble: 0.19, resolutionFrom: 6, resolutionTo: 7, impactPerComplaint: 95, recorder: 'Ayanda Peters' },
    rootCauses: [
      { title: 'Os cálculos de liquidação são feitos manualmente por uma única equipa', description: 'Cada cálculo é feito à mão a partir do plano de amortização, com um limite de cerca de 60 por dia.', category: 'Process', confidence: 'Confirmed', contribution_pct: 60, status: 'Open', evidence: 'Dados de produtividade; profundidade da fila ao longo de 6 meses.', identified_by: 'Pieter Coetzee', identified_on: dateBack(4, 9) },
      { title: 'A validade do cálculo conta a partir da data de cálculo e não da data de envio', description: 'Quando o cliente recebe o cálculo, grande parte da validade já expirou.', category: 'Policy & Product design', confidence: 'Confirmed', contribution_pct: 40, status: 'Open', evidence: 'Política VAF-22; 40 cálculos analisados, em média 3,1 dias de validade restantes na receção.', identified_by: 'Sipho Ndlovu', identified_on: dateBack(3, 14) },
    ],
    actions: [
      { title: 'Cálculo de liquidação autónomo na aplicação e na banca pela internet', description: 'Gerar o cálculo a partir do plano de amortização a pedido.', proposed_by: 'Pieter Coetzee', proposer_role: 'Product owner', proposed_on: dateBack(4, 14), due_date: dateAhead(4), priority: 'High', status: 'Proposed', effectiveness: 'Not assessed', notes: 'Caso de negócio submetido; concorre pela mesma capacidade de entrega que a automatização das contestações.', causeIndex: 0 },
      { title: 'Contar a validade do cálculo a partir da data de envio', description: 'Alteração de política para que o cliente disponha dos 5 dias completos.', proposed_by: 'Pieter Coetzee', proposer_role: 'Product owner', proposed_on: dateBack(3, 18), due_date: dateAhead(1), priority: 'Medium', status: 'Approved', effectiveness: 'Not assessed', notes: 'Aprovação da política de crédito obtida; a alteração no sistema é pequena.', causeIndex: 1 },
    ],
    incidents: [],
    notes: [
      { note_type: 'Observation', body: 'Volume absoluto baixo mas em subida constante, e a causa é uma limitação de capacidade que não se resolve sozinha. Vale a pena manter visível antes que passe a Alta.', author: 'Sipho Ndlovu' },
    ],
  },
  {
    theme: {
      reference: 'RC-2026-011',
      title: 'Clientes de empresas a quem são pedidos repetidamente os mesmos documentos de KYC',
      description: 'É pedido aos clientes empresa que voltem a submeter documentos de KYC já entregues, por vezes três ou quatro vezes por equipas diferentes, e as contas ficam restringidas enquanto os pedidos estão pendentes.',
      product: 'Business Banking', channel: 'Email', category: 'Data & Privacy',
      severity: 'High', status: 'Remediation in progress',
      business_unit: 'Banca de Empresas e Comercial', product_owner: 'Anele Jacobs',
      product_owner_email: 'anele.jacobs@example.bank', complaint_manager: 'Zanele Mthembu',
      first_reported_on: dateBack(15), last_reported_on: dateBack(1, 28),
      target_close_date: dateAhead(3), regulatory_risk: 1, watchlist: 1,
    },
    obs: { seed: 1111, from: 52, to: 78, wobble: 0.17, resolutionFrom: 14, resolutionTo: 12, impactPerComplaint: 380, recorder: 'Zanele Mthembu' },
    rootCauses: [
      { title: 'Não existe um repositório documental partilhado entre abertura de conta, crédito e compliance', description: 'Cada equipa guarda a sua própria cópia, pelo que nenhuma consegue ver que um documento já foi entregue.', category: 'System / Technology', confidence: 'Confirmed', contribution_pct: 55, status: 'Being addressed', evidence: 'Mapa de sistemas; três repositórios documentais distintos em uso.', identified_by: 'Anele Jacobs', identified_on: dateBack(8, 12) },
      { title: 'Os ciclos de atualização não são coordenados entre equipas', description: 'A atualização periódica de KYC corre por equipa com o seu próprio calendário, pelo que o pedido chega ao cliente várias vezes no mesmo trimestre.', category: 'Process', confidence: 'Confirmed', contribution_pct: 30, status: 'Open', evidence: 'Calendários de atualização comparados entre três equipas.', identified_by: 'Zanele Mthembu', identified_on: dateBack(6, 26) },
      { title: 'A restrição é aplicada antes de o cliente ser contactado', description: 'A conta é restringida no dia em que o pedido é criado e não após um período de tolerância.', category: 'Policy & Product design', confidence: 'Confirmed', contribution_pct: 15, status: 'Open', evidence: 'Registo de eventos de restrição face ao registo de contactos efetuados.', identified_by: 'Anele Jacobs', identified_on: dateBack(4, 11) },
    ],
    actions: [
      { title: 'Repositório único de documentos de KYC para as três equipas', description: 'Um único repositório de referência, consultado por todas as equipas antes de criarem um pedido.', proposed_by: 'Anele Jacobs', proposer_role: 'Product owner', proposed_on: dateBack(8, 16), due_date: dateAhead(3), priority: 'Critical', status: 'In progress', effectiveness: 'Not assessed', notes: 'Fase 1 (abertura de conta + compliance) entregue; o crédito entra na fase 2.', causeIndex: 0 },
      { title: 'Coordenar os ciclos de atualização num calendário único por cliente', description: 'Um evento de atualização por cliente e por ciclo, cobrindo os requisitos de todas as equipas.', proposed_by: 'Anele Jacobs', proposer_role: 'Product owner', proposed_on: dateBack(6, 30), due_date: dateAhead(1), priority: 'High', status: 'Approved', effectiveness: 'Not assessed', notes: 'Modelo operativo acordado com o Compliance.', causeIndex: 1 },
      { title: 'Conceder 10 dias úteis de tolerância antes de restringir', description: 'Contactar primeiro e restringir apenas se o cliente não responder.', proposed_by: 'Zanele Mthembu', proposer_role: 'Complaint manager', proposed_on: dateBack(4, 15), due_date: dateBack(2, 27), completed_on: dateBack(2, 21), priority: 'High', status: 'Completed', effectiveness: 'Effective', notes: 'As reclamações que referiam "conta bloqueada sem aviso" caíram acentuadamente.', causeIndex: 2 },
    ],
    incidents: [],
    notes: [
      { note_type: 'Customer feedback', body: 'Um gestor de relação escalou em nome de cinco clientes comerciais que receberam o mesmo pedido de duas equipas na mesma semana. Usado como dossiê de evidência para o calendário coordenado de atualização.', author: 'Anele Jacobs' },
      { note_type: 'Meeting note', body: 'A fase 1 do repositório está em produção e o período de tolerância está a funcionar, mas os volumes continuam a subir porque o crédito ainda não está no repositório. O fórum concordou que o tema se mantém em remediação até a fase 2 entrar.', author: 'Zanele Mthembu' },
    ],
  },
  {
    theme: {
      reference: 'RC-2026-012',
      title: 'Reenvio de sinistros entre o perito e o centro de contacto',
      description: 'Os participantes de sinistro são passados entre o perito e o centro de contacto, cada um dizendo que o processo está com o outro. As reclamações são sobre o reenvio e não sobre a decisão do sinistro.',
      product: 'Insurance', channel: 'Call Centre', category: 'Service & Turnaround',
      severity: 'Medium', status: 'Resolved',
      business_unit: 'Seguros e Património', product_owner: 'Kirsten Botha',
      product_owner_email: 'kirsten.botha@example.bank', complaint_manager: 'Sipho Ndlovu',
      first_reported_on: dateBack(17), last_reported_on: dateBack(3, 28),
      target_close_date: dateBack(1), regulatory_risk: 0, watchlist: 0,
    },
    obs: { seed: 1212, from: 66, to: 9, wobble: 0.14, resolutionFrom: 13, resolutionTo: 5, impactPerComplaint: 150, recorder: 'Ayanda Peters' },
    rootCauses: [
      { title: 'Nenhum responsável nomeado pelo sinistro depois de sair da primeira linha', description: 'A responsabilidade passava implicitamente, pelo que nenhuma das partes assumia o contacto seguinte.', category: 'Process', confidence: 'Confirmed', contribution_pct: 65, status: 'Addressed', evidence: 'Chamadas gravadas em 25 sinistros escalados.', identified_by: 'Kirsten Botha', identified_on: dateBack(14, 8) },
      { title: 'As notas do perito não eram visíveis no centro de contacto', description: 'Os assistentes não conseguiam ver a nota de avaliação mais recente, pelo que não podiam responder sem transferir.', category: 'System / Technology', confidence: 'Confirmed', contribution_pct: 35, status: 'Addressed', evidence: 'Auditoria aos ecrãs; notas do perito guardadas num sistema separado.', identified_by: 'Kirsten Botha', identified_on: dateBack(13, 15) },
    ],
    actions: [
      { title: 'Responsável nomeado para toda a vida do sinistro', description: 'Um único responsável, identificado ao cliente, do registo à liquidação.', proposed_by: 'Kirsten Botha', proposer_role: 'Product owner', proposed_on: dateBack(14, 12), due_date: dateBack(9, 30), completed_on: dateBack(9, 25), priority: 'High', status: 'Completed', effectiveness: 'Effective', notes: 'As transferências por sinistro caíram de 3,4 para 1,1.', causeIndex: 0 },
      { title: 'Mostrar as notas do perito no ecrã do centro de contacto', description: 'Notas do perito em modo de leitura no posto de trabalho do assistente.', proposed_by: 'Kirsten Botha', proposer_role: 'Product owner', proposed_on: dateBack(13, 19), due_date: dateBack(7, 31), completed_on: dateBack(7, 26), priority: 'Medium', status: 'Completed', effectiveness: 'Effective', notes: 'A resolução no primeiro contacto subiu 22 pontos nas questões sobre sinistros.', causeIndex: 1 },
      { title: 'Revisão pós-implementação de três meses antes de encerrar o tema', description: 'Confirmar que a melhoria se mantém antes de o tema ser dado como resolvido.', proposed_by: 'Sipho Ndlovu', proposer_role: 'Complaint manager', proposed_on: dateBack(6, 5), due_date: dateBack(2, 28), completed_on: dateBack(2, 26), priority: 'Low', status: 'Completed', effectiveness: 'Effective', notes: 'Os volumes mantiveram-se abaixo de 12 por mês durante três períodos consecutivos; tema resolvido.', causeIndex: null },
    ],
    incidents: [],
    notes: [
      { note_type: 'Decision', body: 'Tema resolvido. Ambas as causas-raiz foram tratadas e confirmadas como eficazes pela revisão pós-implementação. Mantido no registo como exemplo trabalhado de uma reclamação recorrente encerrada com base em evidência e não no tempo decorrido.', author: 'Sipho Ndlovu' },
    ],
  },
];
