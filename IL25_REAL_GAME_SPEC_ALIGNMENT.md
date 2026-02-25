IL25 – Real Game Alignment Specification
0. Filosofia do Sistema

A app não substitui o EAFC.

Ela serve para:

Gerir finanças

Gerir sponsors

Gerir transfer window

Gerir draft

Gerir competições

Automatizar penalties e cláusulas

Eliminar erro humano do Excel

Os jogos podem ser:

Simulados na app
OU

Inseridos manualmente pelo host (resultado do EAFC Career Mode)

A app deve suportar ambos os modos.

1. Transfer Window – Modelo Real
Como funciona na IL real

Começa quando o host quiser.

Termina quando o host quiser.

Durante a window:

Squads podem ter <21 ou >23 jogadores.

Quando a season começa:

Squad deve estar entre 21 e 23 jogadores.

Máx. 3 GKs.

REGRAS CRÍTICAS

I. Minimum squad: 21
II. Maximum squad: 23
III. Max 3 goalkeepers
IV. Apenas no momento de “registration” da season é que isto é validado
V. Todos os jogadores contam para wage bill
VI. Wage bill funciona como lista oficial registada

👉 Isto altera o que tínhamos antes (25 players).
O limite correto é 23, não 25.

2. Matchdays – Dois Modos
Modo A – Simulação Interna

simulateMatchday()

App gera resultados

Atualiza standings

Modo B – Manual (EAFC Career Mode)

Host joga no EAFC

Host insere resultado manualmente

App:

Atualiza standings

Atualiza competições

Aplica efeitos (ex: IR +1 por 2 golos numa final 

PM S5

)

A app deve ter:

league.match_mode = 'SIMULATED' | 'MANUAL'

Se MANUAL:

simulateMatchday fica desativado

Apenas “Insert Result” disponível

3. Sponsors – Modelo Real

Sponsors começam em S2.

Club Sponsors (S2–S4)

Exemplos reais 

IL '25 Sponsors S2-4 (2)

:

Vodafone

Baixo risco

Pagamentos fixos por season

Bónus por cumprir objetivos específicos

Jogador tem de estar top 14 OVR no fim da window

Spotify

Performance clause:

Reach UCL ou Win UEL

Se falhar:

Highest rated player pede transferência

-2.5% merchandise

Qatar Airways

High risk

Failure:

2 highest rated pedem transferência

-2.5% merch

+$15M repayment penalty

O QUE A APP TEM DE FAZER

Atualmente: nada disto está automatizado.

Precisa de:

sponsor_contract table

sponsor_objective_evaluation at endSeason

Automatic transfer_request flag

Merchandise % modifier system

Penalty repayments

Kit Sponsors (S7–S8)

Kit Supplier S7 & S8 (1)

Contribuições:

Boost IR permanently
OU

+4% merchandise revenue
OU

Tripled merch with permanent -2.5%

IR values:

IR 1–5 com valores fixos

Multiplied by merchandise %

App precisa:

player.international_reputation

merch_base_revenue

merch_percentage

revenue calculation engine

4. Prize Money – Competitions

PM S5

Existem:

Champions League

Europa League

Conference League

Super Cup

Cada uma:

Starting bonus

Semi-final bonus

Final bonus

Winner bonus

Extra rule:
Se jogador marca 2 golos numa final:
→ +1 IR (máx 5)
→ apenas “on paper” (spreadsheet logic)

App deve:

Guardar competição separadamente da liga

Relacionar qualificação com posição na liga

Aplicar prize money automaticamente

5. Competição Internacional – Estrutura

Formato enviado:

Stage One:

10 jogos H&A

Grupos

Stage Two:

5 jogos H&A

Semi-Finals:

2 jogos H&A

Final:

1 jogo

Total: 18 jogos (19 com Super Cup)

App precisa:

competitions table

qualification_rules

stage progression engine

automatic bracket generation

6. Draft – Modelo Real

Hosts:

Criam manualmente jogadores do draft

Podem adicionar perks:

Merch boost %

Upgrade tickets

Special clauses

O draft não é aleatório.
É curated pelos hosts.

App precisa:

createPlayer (admin)

player_type enum

draft_pool table

draft_bonus JSON field

7. Player Table – Arquitetura Correta

Existe:

sofifa_master_players (18k)

Cada league:

league_players table

Importante:

League pode editar stats

Hosts podem melhorar youngsters

IR pode ser alterado

Upgrades aplicados manualmente

Ou seja:
League players são independentes do master table.

8. Wage System Real

Todos os jogadores contam para wage bill.

Wage discounts (imagem enviada):

Drafted player -20%

Packed player -10%

Permanent wage discount

etc.

App precisa:

contract.wage_discount_percent

wage_bill = sum(salary * (1 - discount))

9. Registration Moment (CRÍTICO)

Quando transfer window fecha:

Sistema deve validar:

21 ≤ squad_size ≤ 23

GK ≤ 3

Sem isso → não pode começar season

Auto fine se mal formatado (nome SoFIFA mal escrito)

10. O Que Temos de Mudar no Modelo Anterior
❌ 25 jogadores → deve ser 23
❌ Roster lock sempre → deve ser apenas no início da season
❌ Packs só OFFSEASON → correto manter
❌ Wage deduction no endSeason → manter
❌ Draft automático → não. Draft é manualmente populado
❌ Sponsors simplificados → precisam sistema complexo
❌ CompIndex simples → só top 14 contam
11. Novo Modelo de Season Flow Real

Transfer Window abre (host decide)

Managers:

trades

signings

draft

sponsors escolhidos

Window fecha

Squad registration valida 21–23

Season começa

Matchdays (manual ou simulado)

Competição internacional paralela

Season ends

Sponsors avaliados

Prize money aplicado

IR adjustments

Draft pool criado

Nova transfer window

12. O Que a App Precisa de Ter Que Ainda Não Está 100%

Sponsor engine completo

Merchandise revenue engine

IR-based revenue

Manual result insertion mode

Competition stage engine

Draft perks system

Wage discount system

Registration validator

Automatic transfer requests on sponsor failure

Fine engine

Loan repayment automation