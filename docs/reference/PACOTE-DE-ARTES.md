# Jaguar Gold — pacote de artes de referência (DEMO)

Este pacote contém **PNGs recortados individualmente** de ilustrações originais geradas por IA para o jogo fictício Jaguar Gold.

## Diretórios
- `symbols/`: 11 ícones de rolos (jaguar, máscara, coroa, diamante, sino, trevo, manga, cerejas, baú, WILD e BÔNUS).
- `ui/`: logo, botões, moldura, placas e ícones. `paylines_reference.png` é ilustrativo; calcule e desenhe as 5 linhas corretas no Phaser.
- `backgrounds/`: cenário principal, algumas camadas e versão ampliada 1600×900.
- `effects/`: títulos e brilhos de vitória estáticos.
- `animation/`: tiras ilustrativas para estudar quadros de animação.
- `reference/`: as pranchas completas para manter a direção de arte.

## Uso com Phaser
Copie estas pastas para `public/assets/jaguar-gold/`, com os caminhos preservados. Carregue as imagens usando `this.load.image('symbol_jaguar', '/assets/jaguar-gold/symbols/jaguar.png')` etc. Crie o movimento de rolos e os efeitos no Phaser usando tweens/masks/particles. Não renderize a prancha inteira como tela estática.

## Limitações importantes
- Estes arquivos foram **recortados de uma prancha gerada**, não gerados individualmente em resolução nativa. Alguns têm antialiasing ou halos nas bordas; faça limpeza artística se necessário.
- As tiras `animation/` são material ilustrativo, **não frames registrados com alinhamento perfeito**. Recomenda-se animação por tweens ou criação de novos spritesheets individuais para produção.
- Alguns botões/painéis têm **texto e números estáticos** (como `1.000,00`, `10,00`). Para o HUD funcional, reconstruir placas vazias e desenhar saldo/aposta por cima com `Phaser.GameObjects.Text`.
- Os arquivos de `backgrounds/` são recortes de uma imagem maior. A versão 1600×900 foi ampliada e pode mostrar perda de detalhe em tela cheia; ideal gerar cenários individuais posteriormente.
- **Não há arquivos de áudio** neste pacote. Os elementos que lembram áudio nas pranchas eram apenas ilustrações; sons/músicas devem ser criados/licenciados separadamente.
- Todo dinheiro e saldo do projeto é virtual, sem pagamentos ou resgate.

## Prompt para Claude Code
"Use os PNGs de `public/assets/jaguar-gold/` como assets individuais no Phaser. Mantenha o estilo da prancha em `reference/`, mas não utilize a prancha como tela jogável. Implemente rolos com máscara e movimentação vertical contínua, parada escalonada, sons próprios/licenciados e cálculo de resultados de demonstração. Substitua qualquer placar textual estático por texto dinâmico, preserve transparência e sinalize DEMO — créditos fictícios."
