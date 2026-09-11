# Executar a plataforma no VS Code

*[English version](SETUP.md)*

Tudo o que se segue funciona sem direitos de administrador e sem instalar
pacotes. O único requisito é o **Node 16.17 ou posterior**.

> **Só quer ver a plataforma?** A [demonstração interativa](https://claude.ai/code/artifact/150bf38f-78db-4af6-b427-4f688c4c31fb)
> é a interface completa no navegador, sem instalar nada. Volte aqui quando
> quiser executá-la a sério, guardar os seus próprios dados ou alterar o código.

---

## Passo 1 — Verifique a versão do Node

Abra o VS Code e depois um terminal dentro dele:

**Terminal → New Terminal** (ou `` Ctrl + ` ``)

Escreva:

```bash
node --version
```

| O que aparece | O que fazer |
|---|---|
| `v16.17` ou superior | Está pronto — avance para o Passo 2. |
| Inferior a `v16.17`, ou `command not found` | Leia "Instalar o Node sem direitos de administrador" no fim desta página. |

No Node 16 funciona tudo exceto o reinício automático do `npm run dev`, que
precisa do Node 18.11 — o `npm run dev` deteta isso, arranca normalmente e
avisa que deve reiniciar depois de editar ficheiros.

---

## Passo 2 — Abrir o projeto no VS Code

**Opção A — clonar a partir do VS Code**

1. `Ctrl + Shift + P` para abrir a paleta de comandos
2. Escreva `Git: Clone` e prima Enter
3. Cole: `https://github.com/raeesadam/StandardBank.git`
4. Escolha uma pasta dentro da sua área de utilizador
5. Quando o VS Code perguntar, clique em **Open**

Depois mude para o ramo correto: clique no nome do ramo na barra azul em baixo
à esquerda e escolha `claude/zealous-heisenberg-f87q8d`.

**Opção B — pelo terminal**

```bash
git clone https://github.com/raeesadam/StandardBank.git
cd StandardBank
git checkout claude/zealous-heisenberg-f87q8d
code .
```

### Se o clone falhar com "SSL certificate problem"

```
fatal: unable to access 'https://github.com/...': SSL certificate problem:
unable to get local issuer certificate
```

Isto é a inspeção de TLS da rede da empresa. O seu navegador confia no
certificado raiz da empresa porque ele está no arquivo de certificados do
Windows; o Git traz a sua própria lista e não consulta esse arquivo. Aponte o
Git ao arquivo do Windows — não precisa de direitos de administrador:

```powershell
git config --global http.sslBackend schannel
```

Depois repita o clone. **Não** desative o `http.sslVerify` — isso desliga a
verificação de certificados em todos os repositórios que vier a clonar.

Se mesmo assim não resultar, dispense o Git — veja a **Opção C**.

**Opção C — descarregar em ZIP (sem Git)**

1. No navegador, abra
   <https://github.com/raeesadam/StandardBank/archive/refs/heads/claude/zealous-heisenberg-f87q8d.zip>
2. Descompacte para uma pasta dentro da sua área de utilizador
3. No VS Code: **File → Open Folder** e escolha essa pasta

O seu navegador já confia no certificado da empresa, por isso isto funciona
sempre. Perde o histórico do Git, mas tudo o resto corre da mesma maneira.

---

## Passo 3 — Confirmar que a sua máquina consegue executar

```bash
npm run check
```

Deverá ver:

```
  OK    Node 16.17.0                                 meets the minimum of 16.17
  OK    The data folder is writable                  .../StandardBank/data
  OK    Port 4173 is free                            the platform will be at http://localhost:4173
  OK    The register is empty                        run "npm run seed" to load the demo data

Everything checks out. Next:  npm run seed  then  npm start
```

Se alguma linha disser **FAIL**, o texto ao lado indica exatamente o que fazer.

---

## Passo 4 — Carregar os dados de demonstração

```bash
npm run seed
```

```
Seeded (pt): 12 themes, 216 observations, 30 root_causes, 38 actions, 9 incidents, 20 notes, 137 activity.
```

O registo é carregado em português por omissão. Para o conjunto em inglês:

```bash
npm run seed -- --lang=en
```

---

## Passo 5 — Arrancar

**Com o botão de execução:** prima **F5**. O VS Code arranca a plataforma com o
depurador ligado e abre o navegador. Pode colocar pontos de paragem em qualquer
ficheiro em `server/`.

**Pelo terminal:**

```bash
npm start
```

```
Recurrent Complaints Management platform running at http://localhost:4173
```

Depois abra <http://localhost:4173>.

---

## Passo 6 — Testar

Percorra estes passos no navegador. Se os onze funcionarem, a plataforma está
saudável.

1. **Passe o rato sobre o gráfico de linhas** no painel — uma linha vertical
   acompanha o ponteiro e mostra Recebidas/Resolvidas desse mês
2. **Clique em "Ver tabela"** por baixo do gráfico — aparecem os números
3. **Clique na barra mais longa** em "Reclamações mais recorrentes"
4. **Clique em "Registo de reclamações"** e pesquise `duplicado` — a lista
   reduz-se a uma linha
5. **Limpe a pesquisa e clique numa linha** — abre o detalhe com sete separadores
6. **Histórico de monitorização → + Adicionar um período**: data `2026-10-01`,
   reclamações recebidas `150`, **Adicionar** — o gráfico e os indicadores
   atualizam-se
7. **Adicione outro período com a mesma data** — aparece um erro por baixo do
   campo da data
8. **Elimine** a linha que acabou de criar e confirme
9. **Separador Histórico completo** — a adição *e* a eliminação estão lá, com
   nome e data
10. **Mude "A trabalhar como"** para o seu nome — tudo o que introduzir a
    seguir fica associado a si
11. **Clique em Escuro** e reduza a janela à largura de um telemóvel

Mude também o idioma no seletor do cabeçalho: a interface passa a inglês e as
datas e números acompanham. Os dados do registo não são traduzidos — são dados.

### Testes automáticos

```bash
npm test
```

```
36 tests, all passed  (162ms)
Node 16.17.0
```

---

## Comandos do dia a dia

| Comando | O que faz |
|---|---|
| `npm run check` | Confirma se a máquina consegue executar e explica o que falta |
| `npm run seed` | Carrega o registo de demonstração em português |
| `npm run seed -- --lang=en` | Carrega o conjunto em inglês |
| `npm start` | Arranca a plataforma |
| `npm test` | Corre os 36 testes automáticos |
| `npm run reset` | Apaga e recarrega os dados de demonstração |
| `npm run dev` | Reinicia sozinho quando edita um ficheiro (antes do Node 18.11 arranca normalmente e avisa) |

**Para parar a plataforma:** clique no terminal e prima `Ctrl + C`.

---

## Onde ficam os seus dados

Tudo num único ficheiro: **`data/complaints.json`**, em JSON legível. Está
excluído do Git, por isso nada do que escrever é enviado para fora. Para
recomeçar, apague o ficheiro (ou corra `npm run reset`).

Para o guardar noutro sítio:

```powershell
# Windows PowerShell
$env:RCM_DB_PATH="$HOME\rcm-registo.json"; npm start
```

### Usar outra porta

```powershell
# Windows PowerShell
$env:PORT=8080; npm start
```

Depois abra <http://localhost:8080>.

---

## Se algo correr mal

| O que aparece | O que significa |
|---|---|
| `npm: command not found` | O Node não está instalado, ou o VS Code estava aberto antes da instalação — feche-o e volte a abrir |
| `Port 4173 is already in use` | Já está a correr noutro terminal. Use esse, ou arranque noutra porta |
| `SyntaxError: Unexpected token` no arranque | O seu Node é anterior ao 16.17 — confirme com `node --version` |
| O navegador diz que não consegue ligar | O servidor não está a correr. Veja a linha "running at" no terminal |
| Página em branco | Abriu o `index.html` como ficheiro. Use o endereço `http://localhost:4173` |
| `Could not read the register` | O `data/complaints.json` ficou inválido — apague-o e corra `npm run seed` |

---

## Instalar o Node sem direitos de administrador

**Windows**

- **fnm** ou **nvm-windows** — gestores de versões que instalam no perfil do
  utilizador, sem administrador
- **O ZIP do Node.js** — descarregue o `.zip` (não o `.msi`) em
  <https://nodejs.org/en/download>, descompacte para `C:\Users\<você>\node` e
  no PowerShell: `$env:Path = "C:\Users\<você>\node;$env:Path"`. Para tornar
  permanente, acrescente essa pasta ao `Path` do utilizador em *Editar as
  variáveis de ambiente da sua conta* — o que não exige administrador.

**macOS**

- **nvm**: `curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash`
  e depois `nvm install 20`

Se tudo isto estiver bloqueado, peça "Node.js LTS" à equipa de TI — é um
ambiente de execução comum, sem serviço nem controlador. Entretanto, a
[demonstração](https://claude.ai/code/artifact/150bf38f-78db-4af6-b427-4f688c4c31fb)
dá-lhe a interface completa sem instalar nada.
