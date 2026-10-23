/**
 * Mensagens que abrem prontas no WhatsApp quando a cliente toca num botão do site.
 * Cada uma diz de onde a cliente veio e o que ela quer, para a profissional
 * responder sem precisar perguntar de novo. A cliente pode editar antes de enviar.
 */

const SITE = "pelo site da Unhas de Fada";

export const waMessages = {
  /** Ícone do topo, rodapé e cartão de contato */
  general: `Olá! 😊 Vim ${SITE} e gostaria de agendar um horário. Quais dias e horários você tem disponíveis?`,

  /** Link de ajuda dentro do agendamento */
  bookingHelp: (services: string[]) =>
    services.length
      ? `Olá! 😊 Estou agendando ${SITE} (${services.join(" + ")}) e fiquei com uma dúvida: `
      : `Olá! 😊 Estou agendando ${SITE} e fiquei com uma dúvida: `,

  /** Quando não aparece nenhum horário livre */
  noSlots: (services: string[]) =>
    `Olá! 😊 Tentei agendar ${SITE}${services.length ? ` (${services.join(" + ")})` : ""}, mas não encontrei horário livre. Você consegue um encaixe para mim? Tenho disponibilidade em: `,

  /** Página de privacidade (pedidos sobre dados pessoais) */
  privacy: `Olá! Gostaria de fazer um pedido sobre os meus dados cadastrados ${SITE} (acesso, correção ou exclusão).`,

  /** Página "meu agendamento" */
  appointment: (firstName: string, when: string, services: string) =>
    `Olá! 😊 ${firstName ? `Sou ${firstName} e t` : "T"}enho horário marcado ${SITE}: ${when} (${services}). Gostaria de falar sobre ele: `,
};
