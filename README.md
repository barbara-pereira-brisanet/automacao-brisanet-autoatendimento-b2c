# Automação de Testes - Autoatendimento eSIM (Brisanet)

Projeto de testes End-to-End (E2E) com **Playwright** e **TypeScript**, estruturado conforme os padrões de rastreabilidade, evidenciamento e Quality Gates do **COEQ (Centro de Excelência em Qualidade da Brisanet)**.

## 🎯 Escopo da Suíte
- **Jornada:** Aquisição de chip eSIM por cliente sem cadastro prévio.
- **Ambiente de Testes:** QA (`https://brisanet-d1.cx.brisanet.net.br`).
- **Padrão de Governança:** TMMi Nível 2 / Central da Qualidade (Aba 2 - Gestão COE & Evidências).

## 🚀 Como Executar
1. Instalar dependências:
   ```bash
   npm install

   npx playwright test --ui

   npx playwright test

   