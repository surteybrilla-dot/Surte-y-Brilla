/// Configuración básica
/// Configuración básica
const PHONE_NUMBER = "573027485140"; 

// Reemplaza esta URL con la que te dio Google Apps Script
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxcUSGjKo3eJwYE03II0Fhvyrc-2hYx2shdiJWfovbLHC1rLq3jETXevxfXvj2e1HFo/exec';

let products = [];
let cart = {};

// 1. Cargar productos desde la API oficial de tu Google Sheet
async function loadProducts() {
  try {
    const res = await fetch(APPS_SCRIPT_URL, { redirect: 'follow' });
    
    if (!res.ok) throw new Error("Respuesta de red no ok: " + res.status);
    
    const data = await res.json();
    console.log("Datos crudos recibidos de Google:", data);

    // Mapeo adaptado incluyendo la columna COLORES
    products = data
      .filter(p => p.ID && String(p.ESTADO).toUpperCase() !== 'OCULTO')
      .map(p => ({
        id: String(p.ID).trim(),
        name: p.NOMBRE || 'Sin Nombre',
        category: p.CATEGORIA ? String(p.CATEGORIA).trim().toLowerCase() : 'todos',
        priceUnidad: Number(p.UNIDAD) || 0,
        priceDocena: Number(p.DOCENA) || 0,
        colors: p.COLORES ? String(p.COLORES).split(',').map(c => c.trim()) : [],
        img: p.FOTO && String(p.FOTO).trim() !== '' ? p.FOTO : 'https://via.placeholder.com/300?text=Sin+Foto',
        status: p.ESTADO ? String(p.ESTADO).trim().toUpperCase() : 'DISPONIBLE'
      }));

    console.log("Productos procesados para el catálogo:", products);
    renderCatalog('todos');

  } catch (error) {
    console.error("Error al conectar con Google Sheets:", error);
    document.getElementById('catalog-container').innerHTML = 
      '<p style="padding:20px; text-align:center; color: #ef4444; font-weight: bold;">' +
      'Error de conexión con Google Sheets.<br>' +
      '<span style="font-size:0.85rem; color:#6b7280; font-weight:normal;">Revisa la consola (F12) para ver el detalle.</span>' +
      '</p>';
  }
}   

// 2. Renderizar Catálogo en Pantalla
function renderCatalog(categoryFilter = 'todos') {
  const container = document.getElementById('catalog-container');
  if (!container) return;
  container.innerHTML = '';

  const filterNormalized = categoryFilter.trim().toLowerCase();
  const filtered = filterNormalized === 'todos' 
    ? products 
    : products.filter(p => p.category === filterNormalized);

  if (filtered.length === 0) {
    container.innerHTML = '<p style="padding:20px; text-align:center;">No hay productos en esta categoría.</p>';
    return;
  }

  filtered.forEach(p => {
    const isAgotado = p.status === 'AGOTADO';
    
    // Cantidades actuales en carrito para unidad y docena
    const qtyUnidad = (cart[`${p.id}_unidad`] ? cart[`${p.id}_unidad`].qty : 0);
    const qtyDocena = (cart[`${p.id}_docena`] ? cart[`${p.id}_docena`].qty : 0);

    // Generar bolitas de colores si existen en el Sheet
    let colorsHtml = '';
    if (p.colors && p.colors.length > 0) {
      colorsHtml = `<div class="color-dots-container">`;
      p.colors.forEach(color => {
        colorsHtml += `<span class="color-dot" style="background-color: ${color};" title="${color}"></span>`;
      });
      colorsHtml += `</div>`;
    }

    if (isAgotado) {
      container.innerHTML += `
        <div class="product-card out-of-stock">
          <span class="badge-agotado">AGOTADO</span>
          <div class="product-img-wrapper">
            <img src="${p.img}" alt="${p.name}">
          </div>
          <div>
            <h3 class="product-title">${p.name}</h3>
            ${colorsHtml}
            <p class="product-price">Unidad: $${p.priceUnidad.toLocaleString('es-CO')}</p>
            ${p.priceDocena ? `<p class="price-docena-text">Docena: $${p.priceDocena.toLocaleString('es-CO')}</p>` : ''}
          </div>
          <button class="qty-btn-disabled" disabled>No disponible</button>
        </div>
      `;
    } else {
      container.innerHTML += `
        <div class="product-card">
          <!-- Al hacer clic en la imagen o tarjeta se abre el zoom con fondo oscuro -->
          <div class="product-img-wrapper" onclick="openProductModal('${p.id}')" title="Haz clic para ver más grande">
            <img src="${p.img}" alt="${p.name}">
              
          </div>
          
          <div class="product-info" onclick="openProductModal('${p.id}')">
            <h3 class="product-title">${p.name}</h3>
            ${colorsHtml}
            <div class="product-prices">
              <span class="price-unidad"><b>Unidad:</b> $${p.priceUnidad.toLocaleString('es-CO')}</span>
              ${p.priceDocena ? `<span class="price-docena"><b>Docena:</b> $${p.priceDocena.toLocaleString('es-CO')}</span>` : ''}
            </div>
          </div>

          <!-- Controles separados: Unidad y Docena -->
          <div class="purchase-options">
            <div class="option-row">
              <span class="option-label">Unidad</span>
              <div class="qty-controls">
                <button class="qty-btn" onclick="updateCartItem('${p.id}', 'unidad', -1)">-</button>
                <span class="qty-display">${qtyUnidad}</span>
                <button class="qty-btn" onclick="updateCartItem('${p.id}', 'unidad', 1)">+</button>
              </div>
            </div>
            
            ${p.priceDocena > 0 ? `
            <div class="option-row">
              <span class="option-label">Docena</span>
              <div class="qty-controls">
                <button class="qty-btn" onclick="updateCartItem('${p.id}', 'docena', -1)">-</button>
                <span class="qty-display">${qtyDocena}</span>
                <button class="qty-btn" onclick="updateCartItem('${p.id}', 'docena', 1)">+</button>
              </div>
            </div>` : ''}
          </div>
        </div>
      `;
    }
  });
}

// 3. Funciones para la Ventana Modal (Zoom con fondo oscuro)
function openProductModal(productId) {
  const product = products.find(p => String(p.id) === String(productId));
  if (!product) return;

  const modal = document.getElementById('product-modal');
  const modalContent = document.getElementById('modal-product-content');
  
  let colorsHtml = '';
  if (product.colors && product.colors.length > 0) {
    colorsHtml = `<div class="color-dots-container" style="justify-content: center; margin: 12px 0;">`;
    product.colors.forEach(color => {
      colorsHtml += `<span class="color-dot" style="background-color: ${color}; width: 22px; height: 22px;" title="${color}"></span>`;
    });
    colorsHtml += `</div>`;
  }

  const qtyUnidad = (cart[`${product.id}_unidad`] ? cart[`${product.id}_unidad`].qty : 0);
  const qtyDocena = (cart[`${product.id}_docena`] ? cart[`${product.id}_docena`].qty : 0);

  modalContent.innerHTML = `
    <button class="modal-close" onclick="closeProductModal()">✕</button>
    <div class="modal-img-container">
      <img src="${product.img}" alt="${product.name}">
    </div>
    <h2 class="modal-title">${product.name}</h2>
    ${colorsHtml}
    <div class="modal-prices">
      <p><b>Precio Unidad:</b> $${product.priceUnidad.toLocaleString('es-CO')}</p>
      ${product.priceDocena ? `<p style="color: #2563eb;"><b>Precio Docena:</b> $${product.priceDocena.toLocaleString('es-CO')}</p>` : ''}
    </div>

    <div class="purchase-options" style="margin-top: 15px;">
      <div class="option-row">
        <span class="option-label">Unidad</span>
        <div class="qty-controls">
          <button class="qty-btn" onclick="updateCartItem('${product.id}', 'unidad', -1); openProductModal('${product.id}');">-</button>
          <span class="qty-display">${qtyUnidad}</span>
          <button class="qty-btn" onclick="updateCartItem('${product.id}', 'unidad', 1); openProductModal('${product.id}');">+</button>
        </div>
      </div>
      
      ${product.priceDocena > 0 ? `
      <div class="option-row" style="margin-top: 8px;">
        <span class="option-label">Docena</span>
        <div class="qty-controls">
          <button class="qty-btn" onclick="updateCartItem('${product.id}', 'docena', -1); openProductModal('${product.id}');">-</button>
          <span class="qty-display">${qtyDocena}</span>
          <button class="qty-btn" onclick="updateCartItem('${product.id}', 'docena', 1); openProductModal('${product.id}');">+</button>
        </div>
      </div>` : ''}
    </div>
  `;

  modal.style.display = 'flex';
}

function closeProductModal() {
  const modal = document.getElementById('product-modal');
  if (modal) modal.style.display = 'none';
}

// 4. Modificar Cantidades (Independiente para Unidad y Docena)
function updateCartItem(productId, tipo, change) {
  const product = products.find(p => String(p.id) === String(productId));
  if (!product) return;

  const cartKey = `${productId}_${tipo}`;

  if (!cart[cartKey]) {
    if (change > 0) {
      cart[cartKey] = {
        id: product.id,
        name: product.name,
        tipo: tipo, // 'unidad' o 'docena'
        price: tipo === 'docena' ? product.priceDocena : product.priceUnidad,
        qty: 1
      };
    }
  } else {
    cart[cartKey].qty += change;
    if (cart[cartKey].qty <= 0) {
      delete cart[cartKey];
    }
  }

  updateCartBar();
  const activeBtn = document.querySelector('.cat-btn.active');
  const activeCat = activeBtn ? activeBtn.innerText.toLowerCase() : 'todos';
  renderCatalog(activeCat);
}

// 5. Actualizar Totales del Carrito
function updateCartBar() {
  let totalCount = 0;
  let totalPrice = 0;

  Object.values(cart).forEach(item => {
    totalCount += item.qty;
    totalPrice += item.qty * item.price;
  });

  const countElem = document.getElementById('cart-count');
  const totalElem = document.getElementById('cart-total');
  
  if (countElem) countElem.innerText = totalCount;
  if (totalElem) totalElem.innerText = `$${totalPrice.toLocaleString('es-CO')}`;
}

// 6. Filtro de Categorías
function filterCategory(cat) {
  document.querySelectorAll('.cat-btn').forEach(btn => btn.classList.remove('active'));
  if (event && event.target) event.target.classList.add('active');
  renderCatalog(cat);
}

// 7. Enviar Pedido a WhatsApp especificando unidades y docenas
function sendOrderWhatsApp() {
  const items = Object.values(cart);
  if (items.length === 0) {
    alert("Por favor agrega al menos un producto a tu pedido.");
    return;
  }

  let text = `*¡Hola Surte y Brilla! Quiero hacer el siguiente pedido:*\n\n`;
  let total = 0;

  items.forEach(item => {
    const subtotal = item.qty * item.price;
    total += subtotal;
    const tipoTexto = item.tipo === 'docena' ? 'Docena(s)' : 'Unidad(es)';
    text += `▪ *${item.name}* (${tipoTexto})\n   Cant: ${item.qty} -> $${subtotal.toLocaleString('es-CO')}\n`;
  });

  text += `\n*TOTAL ESTIMADO: $${total.toLocaleString('es-CO')}*`;
  text += `\n\nQuedo a la espera para confirmar existencias y datos de envío.`;

  const encodedText = encodeURIComponent(text);
  window.open(`https://wa.me/${PHONE_NUMBER}?text=${encodedText}`, '_blank');
}

document.addEventListener("DOMContentLoaded", loadProducts);