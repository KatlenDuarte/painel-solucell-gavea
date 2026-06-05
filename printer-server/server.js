const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const { print } = require("pdf-to-printer");

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));

const PRINTER_NAME = "ELGIN"; 
// Se não funcionar, coloque o nome exato da impressora no Windows.
// Exemplo: "ELGIN i9", "Elgin i9(USB)", etc.

function formatMoney(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function gerarHtmlCupom(sale) {
  const itens = (sale.items || [])
    .map((item) => {
      const qtd = item.saleQty || 1;
      const total = Number(item.price || 0) * qtd;

      return `
        <tr>
          <td>${qtd}x ${item.name}</td>
          <td style="text-align:right">${formatMoney(total)}</td>
        </tr>
      `;
    })
    .join("");

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8" />
      <style>
        body {
          font-family: monospace;
          width: 280px;
          font-size: 11px;
          margin: 0;
          padding: 8px;
        }

        h1 {
          font-size: 16px;
          text-align: center;
          margin: 0 0 4px 0;
        }

        p {
          margin: 3px 0;
          text-align: center;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 8px;
        }

        td {
          padding: 3px 0;
          vertical-align: top;
        }

        .linha {
          border-top: 1px dashed #000;
          margin: 8px 0;
        }

        .total {
          font-size: 15px;
          font-weight: bold;
          display: flex;
          justify-content: space-between;
          margin-top: 8px;
        }

        .small {
          font-size: 10px;
        }
      </style>
    </head>
    <body>
      <h1>SUA LOJA</h1>
      <p>CUPOM NÃO FISCAL</p>
      <p class="small">${new Date().toLocaleString("pt-BR")}</p>

      <div class="linha"></div>

      <table>
        ${itens}
      </table>

      <div class="linha"></div>

      <div class="total">
        <span>TOTAL</span>
        <span>${formatMoney(sale.total)}</span>
      </div>

      <p>Pagamento: ${sale.paymentMethod || "Não informado"}</p>

      <div class="linha"></div>

      <p>Obrigado pela preferência!</p>
      <p class="small">Sistema PDV</p>
    </body>
    </html>
  `;
}

app.post("/print", async (req, res) => {
  try {
    const sale = req.body;

    const html = gerarHtmlCupom(sale);
    const filePath = path.join(__dirname, "cupom.html");

    fs.writeFileSync(filePath, html, "utf8");

    await print(filePath, {
      printer: PRINTER_NAME,
      silent: true,
    });

    return res.json({
      success: true,
      message: "Cupom enviado para impressão.",
    });
  } catch (error) {
    console.error("Erro ao imprimir:", error);

    return res.status(500).json({
      success: false,
      message: "Erro ao imprimir.",
      error: error.message,
    });
  }
});

app.listen(3333, () => {
  console.log("Servidor de impressão rodando em http://localhost:3333");
});