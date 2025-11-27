let selectedNode = null;
let imageTransformer = null;

document.addEventListener("keydown", function(e) {
    if ((e.key === "Delete" || e.key === "Backspace") && selectedNode) {
        if (imageTransformer) {
            imageTransformer.nodes([]);
        }
        selectedNode.destroy();
        selectedNode = null;
        layer.draw();
    }
});

// --- Jules injected template loader ------------------------------------------------
function loadTemplateFromURL(url) {
    console.log(`Loading template from: ${url}`);
    Konva.Image.fromURL(url, (image) => {
        console.log('Konva.Image.fromURL callback executed.');
        const stage = getStage();
        if (!stage) {
            console.error('Stage is not available.');
            return;
        }
        console.log('Stage found.');

        const container = stage.container();
        const aspectRatio = image.width() / image.height();
        const maxWidth = container.clientWidth;
        const maxHeight = container.clientHeight;

        let newWidth = maxWidth;
        let newHeight = newWidth / aspectRatio;

        if (newHeight > maxHeight) {
            newHeight = maxHeight;
            newWidth = newHeight * aspectRatio;
        }

        image.setAttrs({
            width: newWidth,
            height: newHeight,
            x: (maxWidth - newWidth) / 2,
            y: (maxHeight - newHeight) / 2,
        });

        const layer = getActiveLayer();
        if (!layer) {
            console.error('Active layer is not available.');
            return;
        }
        console.log('Active layer found.');

        layer.add(image);
        image.draggable(true);

        if (imageTransformer) {
            imageTransformer.nodes([image]);
        } else {
            imageTransformer = new Konva.Transformer({
                nodes: [image],
                rotateEnabled: true,
                enabledAnchors: [
                    "top-left", "top-right",
                    "bottom-left", "bottom-right"
                ]
            });
            layer.add(imageTransformer);
        }

        image.on("click", () => {
            selectedNode = image;
            imageTransformer.nodes([image]);
            layer.draw();
        });

        layer.batchDraw(); // Explicitly redraw the layer
        console.log('Image added to layer and layer redrawn.');
        hideWelcomeMessage();
        recordState();
        console.log('Template loaded and state recorded.');
    }, (err) => {
        console.error('Failed to load image from URL:', url, err);
        alert(`Failed to load template image: ${url}. Please check the console for more details.`);
    });
}

function getStage() {
    return stage;
}

function getActiveLayer() {
    return layer;
}

function hideWelcomeMessage() {
    // Find and remove the welcome message text node
    const textNode = layer.findOne('Text');
    if (textNode && textNode.text().includes('Welcome')) {
        textNode.destroy();
    }
}

function recordState() {
    saveState();
}
// -----------------------------------------------------------------------------------

// =========================================================
// ⚡️ GLOBAL KONVA VARIABLE DECLARATIONS
// =========================================================
let selectedShape = null;
let stage;
let layer;
let transformer;
let container;
let mockup;
const DEFAULT_WIDTH = 300;
const DEFAULT_HEIGHT = 550;

// --- History/State Management ---
let history = [];
let historyPointer = -1;
const HISTORY_LIMIT = 50;

// =========================================================
// ⚡️ GLOBAL HELPER FUNCTIONS (FIXED SCOPE ERROR)
// =========================================================

/**
 * Saves the current state of the Konva layer to the history stack.
 */
function saveState() {
    if (historyPointer < history.length - 1) {
        history = history.slice(0, historyPointer + 1);
    }
    const state = layer.toJSON();
    history.push(state);

    if (history.length > HISTORY_LIMIT) {
        history.shift();
    }
    historyPointer = history.length - 1;
}

/**
 * Loads a previous or next state from history (Undo/Redo).
 */
function loadState(isUndo) {
    let newPointer = historyPointer;
    if (isUndo) {
        newPointer--;
    } else {
        newPointer++;
    }

    if (newPointer >= 0 && newPointer < history.length) {
        historyPointer = newPointer;
        const state = history[historyPointer];

        // Use Konva.Node.create to reliably parse the JSON state
        const tempLayer = Konva.Node.create(state, 'editor-canvas-container');

        // Destroy all current layer children
        layer.destroyChildren();

        // Re-add the transformer
        transformer = new Konva.Transformer();
        layer.add(transformer);

        // Move children from temp layer to real layer, and re-setup listeners
        tempLayer.children.forEach(node => {
            if (node.hasName('editable-shape')) {
                layer.add(node);

                if (node.getClassName() === 'Text') {
                    setupTextListeners(node);
                } else if (node.getClassName() === 'Image') {
                    setupImageListeners(node);
                }
            }
        });

        tempLayer.destroy();
        deselectShape();
        layer.batchDraw();
    }
}


/**
 * Attaches Konva event listeners specific to Text nodes.
 */
function setupTextListeners(textNode) {
    const floatingToolbar = document.getElementById('floating-toolbar');

    textNode.on('click tap', function () {
        selectShape(textNode);
    });
    textNode.on('dblclick dbltap', () => startTextEdit(textNode));
    textNode.on('dragend', saveState);
    textNode.on('transformend', saveState);
}

/**
 * Attaches Konva event listeners specific to Image nodes.
 */
function setupImageListeners(imageNode) {
    const floatingToolbar = document.getElementById('floating-toolbar');

    imageNode.on('click tap', function () {
        selectShape(imageNode);
    });
    imageNode.on('dragend', saveState);
    imageNode.on('transformend', saveState);
}

/**
 * Selects a shape on the canvas, showing the transformer and sidebar.
 * @param {Konva.Shape} shape The shape to select.
 */
function selectShape(shape) {
    const floatingToolbar = document.getElementById('floating-toolbar');

    selectedShape = shape;
    transformer.nodes([selectedShape]);
    setupSidebar(selectedShape);
    if (floatingToolbar) floatingToolbar.classList.add('active');
    layer.batchDraw();
}

/**
 * Adds a new text element to the Konva canvas.
 */
function addTextToCanvas(initialText, size, color, x = 50, y = 150, align = 'left') {
    const newText = new Konva.Text({
        x: x,
        y: y,
        text: initialText,
        fontSize: size,
        fill: color,
        align: align,
        draggable: true,
        name: 'editable-shape',
        wrap: 'word',
        width: stage.width() - 100
    });

    setupTextListeners(newText);
    layer.add(newText);
    layer.batchDraw();
    return newText;
}

/**
 * Adds a new rectangle element to the Konva canvas.
 */
function addRectangleToCanvas(x, y, width, height, color) {
    const newRect = new Konva.Rect({
        x: x,
        y: y,
        width: width,
        height: height,
        fill: color,
        draggable: true,
        name: 'editable-shape'
    });

    // For simplicity, we'll use image listeners for rectangles as they share similar behaviors
    setupImageListeners(newRect);
    layer.add(newRect);
    // Move rectangle to the back
    newRect.zIndex(0);
    layer.batchDraw();
    return newRect;
}

/**
Applies current shape properties to the sidebar.
@param {Konva.Shape | Konva.Node} shape */
function setupSidebar(shape) {
    const opacitySlider = document.getElementById('opacity-slider');
    const opacityValueSpan = document.getElementById('opacity-value');
    const shadowToggle = document.getElementById('shadow-toggle');
    const shadowControls = document.getElementById('shadow-controls');

    // Canvas Color Pickers - (NOTE: Canvas controls not handled here, only shape)
    const canvasColorPicker = document.getElementById('canvas-color-picker');
    const canvasColorHex = document.getElementById('canvas-color-hex');

    // TAB REFERENCES
    const styleButton = document.querySelector('[data-right-target="style-props"]');
    const animButton = document.querySelector('[data-right-target="anim-props"]');
    const textButton = document.querySelector('[data-right-target="text-props"]');

    // --- Phase 1: Reset All ---
    // Hide all content panels
    document.querySelectorAll('.right-tab-content').forEach(el => el.style.display = 'none');
    // Hide all right-sidebar buttons (we will re-show only necessary ones)
    document.querySelectorAll('.sidebar-tabs-right button').forEach(btn => btn.style.display = 'none');
    // De-activate all buttons
    document.querySelectorAll('.sidebar-tabs-right button').forEach(btn => btn.classList.remove('active'));

    // --- Phase 2: Canvas Properties (No shape selected) ---
    if (!shape) {
        // Show all buttons for the default canvas view (assuming Canvas is always shown)
        document.querySelectorAll('.sidebar-tabs-right button').forEach(btn => btn.style.display = 'block');

        // Find the canvas tab and activate it (assuming canvas-props is one of the content IDs)
        const canvasButton = document.querySelector('[data-right-target="canvas-props"]');
        if (canvasButton) {
            canvasButton.click(); // Assuming this click handler activates the content
            canvasButton.classList.add('active');
        }

        // Handle canvas color picker update if needed (Logic omitted for brevity, keeping original JS structure)
        if (canvasColorPicker) {
            const stageColor = stage.container().style.backgroundColor || '#333333';
            canvasColorPicker.value = rgbToHex(stageColor);
            if (canvasColorHex) canvasColorHex.value = rgbToHex(stageColor);
        }

        return; // Exit function
    }

    // --- Phase 3: Shape Properties (Shape IS selected) ---

    // 1. Show Base Tabs (Style and Animation)
    if (styleButton) styleButton.style.display = 'block';
    if (animButton) animButton.style.display = 'block';

    let defaultTabId = 'style-props'; // Default to Style tab content
    let defaultButton = styleButton;

    // 2. Element-specific Tabs
    const isImage = shape.getClassName() === 'Image';
    const isText = shape.getClassName() === 'Text';

    // Text: Text Properties Tab Logic
    if (isText) {
        // Text properties might be handled in a separate 'text-props' tab or within 'style-props'
        if (textButton) {
            textButton.style.display = 'block';

            // Text controls update
            document.getElementById('font-family-select').value = shape.fontFamily();
            const fontSize = shape.fontSize();
            document.getElementById('font-size-slider').value = fontSize;
            document.getElementById('font-size-value').textContent = `${fontSize}px`;

            const textColor = shape.fill() || '#ffffff';
            document.getElementById('color-picker').value = textColor;
            document.getElementById('color-hex-input').value = textColor;
        }
    }

    // 3. Set Active Tab and Content (This fixes the overlap)
    if (defaultButton && defaultButton.classList) {
        defaultButton.classList.add('active');
    }
    const defaultContent = document.getElementById(defaultTabId);
    if (defaultContent) {
        defaultContent.style.display = 'block';
    }

    // 4. Update General Style/Shadow Controls (Visible in Style tab)
    // Opacity
    if (opacitySlider && opacityValueSpan) {
        opacitySlider.value = shape.opacity() * 100;
        opacityValueSpan.textContent = `${Math.round(shape.opacity() * 100)}%`;
    }

    // Shadow
    const hasShadow = shape.shadowEnabled();
    if (shadowToggle) {
        shadowToggle.checked = hasShadow;
    }
    if (shadowControls) {
        shadowControls.style.display = hasShadow ? 'block' : 'none';
        if (hasShadow) {
            document.getElementById('shadow-color').value = shape.shadowColor() || '#000000';
            document.getElementById('shadow-offset-x').value = shape.shadowOffsetX() || 5;
            document.getElementById('shadow-offset-y').value = shape.shadowOffsetY() || 5;
        }
    }
}

/**
 * Removes the current selected shape and transformer, and resets controls.
 */
function deselectShape() {
    const floatingToolbar = document.getElementById('floating-toolbar');

    if (floatingToolbar) floatingToolbar.classList.remove('active');
    selectedShape = null;

    if (transformer) transformer.nodes([]);

    // Hide all type-specific groups
    if (document.getElementById('color-group')) document.getElementById('color-group').style.display = 'none';
    if (document.getElementById('font-group')) document.getElementById('font-group').style.display = 'none';

    // Ensure all controls are reset/unchecked to prevent ghost state
    if (document.getElementById('shadow-toggle')) document.getElementById('shadow-toggle').checked = false;
    if (document.getElementById('animation-select')) document.getElementById('animation-select').value = 'none';

    // Switch back to the default Style tab
    const rightTabs = document.querySelectorAll('.right-sidebar .right-tab-button');
    const rightContents = document.querySelectorAll('.right-sidebar .right-tab-content');

    rightTabs.forEach(btn => btn.classList.remove('active'));
    rightContents.forEach(content => content.classList.remove('active'));

    const styleButton = document.querySelector('[data-right-target="style-props"]');
    const styleContent = document.getElementById('style-props');
    if (styleButton) styleButton.classList.add('active');
    if (styleContent) styleContent.classList.add('active');

    if (layer) layer.batchDraw();
}

/**
 * Initiates in-place text editing for the selected Konva Text node.
 * This is crucial for the template text to be editable.
 */
function startTextEdit(textNode) {
    deselectShape();
    textNode.hide();
    layer.draw();

    const textPosition = textNode.absolutePosition();
    const stageBox = stage.container().getBoundingClientRect();

    const areaPosition = {
        x: stageBox.left + textPosition.x,
        y: stageBox.top + textPosition.y,
    };

    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);

    // Apply styles and content
    textarea.value = textNode.text();
    textarea.style.position = 'absolute';
    textarea.style.top = areaPosition.y + 'px';
    textarea.style.left = areaPosition.x + 'px';
    textarea.style.width = textNode.width() - textNode.padding() * 2 + 'px';
    textarea.style.height = textNode.height() - textNode.padding() * 2 + 'px';
    textarea.style.fontSize = textNode.fontSize() + 'px';
    textarea.style.fontFamily = textNode.fontFamily();
    textarea.style.color = textNode.fill();
    textarea.style.lineHeight = textNode.lineHeight();
    textarea.style.padding = '0px';
    textarea.style.margin = '0px';
    textarea.style.overflow = 'hidden';
    textarea.style.background = 'none';
    textarea.style.border = '1px dashed #05eafa';
    textarea.style.outline = 'none';
    textarea.style.resize = 'none';
    textarea.style.zIndex = 999;

    textarea.focus();

    function removeTextarea() {
        textarea.removeEventListener('blur', removeTextarea);
        textarea.removeEventListener('keydown', handleKeydown);

        textNode.text(textarea.value);
        textNode.show();
        layer.draw();

        document.body.removeChild(textarea);
        saveState();
    }

    function handleKeydown(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            removeTextarea();
        }
    }

    textarea.addEventListener('blur', removeTextarea);
    textarea.addEventListener('keydown', handleKeydown);
}
/**
 * Applies a simple animation to a Konva node.
 */
function applyAnimation(node, type) {
    if (!Konva.Tween) return;

    // Stop and destroy any previous animation on this node
    const activeTween = node.getAttr('activeTween');
    if (activeTween) {
        activeTween.pause();
        activeTween.destroy();
        node.setAttr('activeTween', null);
    }

    // Reset properties before applying a new animation
    node.opacity(1);
    node.scaleX(1);
    node.scaleY(1);
    // Restore original position if it was saved
    const originalPos = node.getAttr('originalPos');
    if (originalPos) {
        node.position(originalPos);
    }

    node.setAttr('currentAnimation', type);

    if (type === 'none') {
        node.opacity(1); // Ensure opacity is reset
        layer.batchDraw();
        return;
    }

    if (type === 'fade_jiggle') {
        const originalY = node.y();

        node.opacity(0);

        const fadeIn = new Konva.Tween({
            node: node,
            duration: 0.5,
            opacity: 1,
            easing: Konva.Easings.EaseIn,
            onFinish: () => {
                const jiggle = new Konva.Tween({
                    node: node,
                    duration: 0.8,
                    y: originalY - 10,
                    easing: Konva.Easings.ElasticEaseOut,
                    onFinish: () => {
                        node.y(originalY);
                        layer.batchDraw();
                    }
                });
                node.setAttr('activeTween', jiggle);
                jiggle.play();
            }
        });

        node.setAttr('activeTween', fadeIn);
        fadeIn.play();
    } else if (type === 'slide_in_left') {
        const originalX = node.x();
        node.setAttr('originalPos', { x: originalX, y: node.y() });

        node.x(-node.width());
        node.opacity(0);

        const slideIn = new Konva.Tween({
            node: node,
            duration: 0.6,
            x: originalX,
            opacity: 1,
            easing: Konva.Easings.EaseOut
        });

        node.setAttr('activeTween', slideIn);
        slideIn.play();

    } else if (type === 'zoom_in') {
        node.scaleX(0.1);
        node.scaleY(0.1);
        node.opacity(0);

        const zoomIn = new Konva.Tween({
            node: node,
            duration: 0.5,
            scaleX: 1,
            scaleY: 1,
            opacity: 1,
            easing: Konva.Easings.BackEaseOut
        });

        node.setAttr('activeTween', zoomIn);
        zoomIn.play();
    }
    layer.batchDraw();
}

/**
 * Loads and sets up a new image on the canvas.
 */
function loadAndSetupImage(img) {
    let imgWidth = img.width;
    let imgHeight = img.height;
    const maxWidth = stage.width() * 0.8;
    const maxHeight = stage.height() * 0.8;

    if (imgWidth > maxWidth || imgHeight > maxHeight) {
        const ratio = Math.min(maxWidth / imgWidth, maxHeight / imgHeight);
        imgWidth *= ratio;
        imgHeight *= ratio;
    }

    const konvaImage = new Konva.Image({
        image: img,
        x: stage.width() / 2 - imgWidth / 2,
        y: stage.height() / 2 - imgHeight / 2,
        width: imgWidth,
        height: imgHeight,
        draggable: true,
        name: 'editable-shape'
    });

    setupImageListeners(konvaImage);
    layer.add(konvaImage);
    layer.batchDraw();
}

function handleDrop(e) {
    e.preventDefault();
    const mockup = document.querySelector('.device-mockup');
    if (mockup) mockup.style.boxShadow = '0 0 0 5px #000, 0 10px 30px rgba(0, 0, 0, 0.5)';

    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0].type.match('image.*')) {
        const reader = new FileReader();
        reader.onload = function (event) {
            const img = new Image();
            img.crossOrigin = 'Anonymous';
            img.onload = function() {
                const pos = stage.getPointerPosition();
                const shape = layer.getIntersection(pos);

                if (shape && (shape.id() === 'media-placeholder' || shape.id() === 'image-placeholder' || shape.id() === 'circle-placeholder')) {
                    shape.fill({
                        image: img
                    });
                    layer.batchDraw();
                    saveState();
                } else {
                    loadAndSetupImage(img);
                    saveState();
                }
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(e.dataTransfer.files[0]);
    }
}

/**
 * Toggles bold style for a selected text node.
 */
function toggleTextBold() {
    if (selectedShape && selectedShape.getClassName() === 'Text') {
        const currentStyle = selectedShape.fontStyle() || 'normal';
        const isBold = currentStyle.includes('bold');
        const isItalic = currentStyle.includes('italic');

        let newStyle;
        if (isBold) {
            newStyle = isItalic ? 'italic' : 'normal';
        } else {
            newStyle = isItalic ? 'bold italic' : 'bold';
        }
        selectedShape.fontStyle(newStyle);
        layer.batchDraw();
    }
}

function toggleTextItalic() {
    if (selectedShape && selectedShape.getClassName() === 'Text') {
        const currentStyle = selectedShape.fontStyle() || 'normal';
        const isBold = currentStyle.includes('bold');
        const isItalic = currentStyle.includes('italic');

        let newStyle;
        if (isItalic) {
            newStyle = isBold ? 'bold' : 'normal';
        } else {
            newStyle = isBold ? 'bold italic' : 'italic';
        }
        selectedShape.fontStyle(newStyle);
        layer.batchDraw();
    }
}

function increaseFontSize() {
    if (selectedShape && selectedShape.getClassName() === 'Text') {
        selectedShape.fontSize(selectedShape.fontSize() + 2);
        layer.batchDraw();
    }
}

function deleteSelectedShape() {
    if (selectedShape) {
        transformer.nodes([]);
        selectedShape.destroy();
        selectedShape = null;
        document.getElementById('floating-toolbar').classList.remove('active');
        layer.batchDraw();
    }
}

function duplicateSelectedShape() {
    if (selectedShape) {
        const clone = selectedShape.clone();
        clone.x(selectedShape.x() + 20);
        clone.y(selectedShape.y() + 20);
        clone.name('editable-shape');

        if (clone.getClassName() === 'Text') {
            setupTextListeners(clone);
        } else {
            setupImageListeners(clone);
        }

        layer.add(clone);
        deselectShape();
        layer.batchDraw();
    }
}

/**
 * Exports the Konva stage as a PNG image and triggers a download.
 */
function exportCanvas() {
    if (!stage) return;

    // Temporarily hide the transformer
    if (transformer) transformer.nodes([]);
    layer.batchDraw();

    const dataURL = stage.toDataURL({
        pixelRatio: 3, // Export at 3x resolution for high quality
        mimeType: 'image/png'
    });

    // Restore transformer
    if (transformer && selectedShape) transformer.nodes([selectedShape]);
    layer.batchDraw();

    // Trigger download
    const link = document.createElement('a');
    link.href = dataURL;
    link.download = 'twin-clouds-design.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

/**
 * Simulates posting the content to a social media API.
 */
function simulatePost() {
    alert("Connecting to Social Media API...");
    // Simulate a delay for the API call
    setTimeout(() => {
        alert("Post Scheduled!");
    }, 1500);
}

function resizeCanvas(newWidth, newHeight) {
    const mockup = document.querySelector('.device-mockup');
    if (mockup) {
        mockup.style.width = `${newWidth}px`;
        mockup.style.height = `${newHeight}px`;
    }

    if (stage) {
        stage.width(newWidth);
        stage.height(newHeight);
    }

    if (layer) layer.batchDraw();
}

function setupSidebarTabs(buttonSelector, contentSelector) {
    const tabs = document.querySelectorAll(`${buttonSelector} button`);
    const contents = document.querySelectorAll(contentSelector);

    tabs.forEach(button => {
        button.addEventListener('click', () => {
            const targetId = button.dataset.target || button.dataset.rightTarget;

            tabs.forEach(btn => btn.classList.remove('active'));
            contents.forEach(content => content.classList.remove('active'));

            button.classList.add('active');
            const targetElement = document.getElementById(targetId);
            if (targetElement) targetElement.classList.add('active');
        });
    });
}

function handleRightTabClick(event) {
    const targetButton = event.currentTarget;
    const targetId = targetButton.getAttribute('data-right-target');

    // Deactivate all buttons and hide all content
    document.querySelectorAll('.sidebar-tabs-right button').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.right-tab-content').forEach(el => el.style.display = 'none');

    // Activate the clicked button and show the corresponding content
    targetButton.classList.add('active');
    const targetContent = document.getElementById(targetId);
    if (targetContent) {
        targetContent.style.display = 'block';
    }
}


// =========================================================
// ⚡️ TEMPLATE DATA & FUNCTIONS
// =========================================================

// =========================================================
// ⚡️ TEMPLATE DATA DEFINITIONS (All 5 Templates)
// =========================================================

const TEMPLATE_DATA = {

  carousel1: {
    className: "Layer",
    children: [
      { className: "Image", attrs: { src: "assets/templates/carousel1.jpg", width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT }, isBackground: true, id: "bg" },
      { className: "Text", text: "YOUR HEADLINE", x: 40, y: 80, fontSize: 38, fill: "#FFFFFF", fontFamily: "Bebas Neue", draggable: true, id: "headline" },
      { className: "Text", text: "Your subtitle goes here", x: 40, y: 140, width: DEFAULT_WIDTH - 80, fontSize: 18, fill: "#FFFFFF", fontFamily: "Raleway", draggable: true, id: "subtitle" }
    ]
  },

  carousel2: {
    className: "Layer",
    children: [
      { className: "Image", attrs: { src: "assets/templates/carousel2.jpg", width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT }, isBackground: true, id: "bg" },
      { className: "Text", text: "MAIN TITLE", x: 40, y: 70, fontSize: 40, fill: "#FFFFFF", fontFamily: "Oswald", draggable: true, id: "title" },
      { className: "Text", text: "Secondary text here", x: 40, y: 150, width: DEFAULT_WIDTH - 80, fontSize: 18, fill: "#F2F2F2", fontFamily: "Raleway", draggable: true, id: "body" }
    ]
  },

  carousel3: {
    className: "Layer",
    children: [
      { className: "Image", attrs: { src: "assets/templates/carousel3.jpg", width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT }, isBackground: true, id: "bg" },
      { className: "Text", text: "QUOTE TITLE", x: 40, y: 60, fontSize: 34, fill: "#FFFFFF", fontFamily: "Anton", draggable: true, id: "quote_title" },
      { className: "Text", text: "Supporting text here", x: 40, y: 140, width: DEFAULT_WIDTH - 80, fontSize: 18, fill: "#FFFFFF", fontFamily: "Raleway", draggable: true, id: "quote_body" }
    ]
  },

  carousel4: {
    className: "Layer",
    children: [
      { className: "Image", attrs: { src: "assets/templates/carousel4.jpg", width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT }, isBackground: true, id: "bg" },
      { className: "Text", text: "CALL TO ACTION", x: 40, y: 70, fontSize: 42, fill: "#FFFFFF", fontFamily: "Oswald", draggable: true, id: "cta_title" },
      { className: "Rect", x: 40, y: 150, width: 180, height: 50, cornerRadius: 8, fill: "#FFB531", draggable: true, id: "cta_rect" },
      { className: "Text", text: "LEARN MORE", x: 60, y: 162, fontSize: 20, fill: "#141414", fontFamily: "Anton", draggable: true, id: "cta_text" }
    ]
  }

};

async function loadTemplate(templateKey) {
    const template = TEMPLATE_DATA[templateKey];
    if (!template) {
        console.error(`Template "${templateKey}" not found`);
        return;
    }

    // Clear the layer and reset state
    layer.destroyChildren();
    transformer = new Konva.Transformer(); // Re-add transformer
    layer.add(transformer);
    deselectShape();

    const imageNodesData = template.children.filter(node => node.className === 'Image');
    const otherNodesData = template.children.filter(node => node.className !== 'Image');

    // Create promises for loading all images using Konva's built-in method
    const imageLoadPromises = imageNodesData.map(nodeData => {
        return new Promise((resolve, reject) => {
            Konva.Image.fromURL(
                nodeData.attrs.src,
                (konvaImage) => {
                    konvaImage.setAttrs({
                        ...nodeData.attrs,
                        name: 'editable-shape',
                        id: nodeData.id,
                        isBackground: nodeData.isBackground
                    });
                    layer.add(konvaImage);
                    setupImageListeners(konvaImage);
                    if (nodeData.isBackground) {
                        konvaImage.moveToBottom();
                    }
                    resolve(konvaImage);
                },
                (err) => reject(`Failed to load image at ${nodeData.attrs.src}`)
            );
        });
    });

    // Add non-image nodes synchronously
    otherNodesData.forEach(nodeData => {
        const NodeClass = Konva[nodeData.className];
        if (NodeClass) {
            const config = { ...nodeData, name: 'editable-shape' };
            delete config.className;
            const node = new NodeClass(config);

            if (node instanceof Konva.Text) {
                setupTextListeners(node);
            } else {
                setupImageListeners(node); // For Rect, etc.
            }
            layer.add(node);
        }
    });

    // Wait for all images to load and then finalize the canvas
    try {
        await Promise.all(imageLoadPromises);
        layer.batchDraw();
        saveState();

        const shapes = layer.find('.editable-shape').filter(n => !n.getAttr('isBackground'));
        if (shapes.length > 0) {
            selectShape(shapes[0]);
        }

        // Dispatch a custom event to signal that the template is fully loaded
        stage.container().dispatchEvent(new CustomEvent('images-loaded'));
    } catch (error) {
        console.error("Error loading one or more template images:", error);
    }
}


// =========================================================
// ⚡️ MAIN INITIALIZATION & KONVA SETUP
// =========================================================

document.addEventListener('DOMContentLoaded', initEditor);

function initEditor() {

  // Injected listener to apply templates from sidebar
  document.addEventListener('template:apply', function(e) {
    const url = e.detail && e.detail.url;
    if (!url) return;
    console.log('Editor received template request for:', url);
    if (typeof loadTemplateFromURL === 'function') {
      loadTemplateFromURL(url);
    } else {
      console.error('loadTemplateFromURL not defined.');
    }
  });



    // --- Konva Initialization ---
    function initKonva(width, height) {
        container = document.getElementById('editor-canvas-container'); // Must match the ID in editor.html
        if (!container) {
            console.error("Konva canvas container 'editor-canvas-container' not found. Stage failed to initialize.");
            return;
        }

        stage = new Konva.Stage({
            container: 'editor-canvas-container',
            width: width,
            height: height,
            draggable: true
        });

        layer = new Konva.Layer();
        stage.add(layer);

        transformer = new Konva.Transformer();
        layer.add(transformer);

        addTextToCanvas('Welcome to Twin Clouds Editor!', 30, '#FFFFFF', 30, 100);

        saveState();

        stage.on('click tap', function (e) {
            if (e.target === stage || !e.target.hasName('editable-shape')) {
                deselectShape();
            }
        });
    }

    // DOM ELEMENT REFERENCES
    mockup = document.querySelector('.device-mockup');
    const presetSizeSelect = document.getElementById('preset-size');
    const mediaUploadInput = document.getElementById('media-upload');
    const uploadBtn = document.getElementById('upload-btn');
    const opacitySlider = document.getElementById('opacity-slider');
    const colorPicker = document.getElementById('color-picker');
    const colorHexInput = document.getElementById('color-hex-input');
    const fontFamilySelect = document.getElementById('font-family-select');
    const shadowToggle = document.getElementById('shadow-toggle');
    const animationSelect = document.getElementById('animation-select');
    const undoBtn = document.getElementById('undo-btn');
    const redoBtn = document.getElementById('redo-btn');
    const audioUploadBtn = document.getElementById('upload-audio-btn');
    const audioUploadInput = document.getElementById('audio-upload-input');
    const backgroundAudio = document.getElementById('background-audio');
    const audioPlayerControls = document.getElementById('audio-player-controls');
    const exportBtn = document.querySelector('.btn-export');
    const postBtn = document.querySelector('.btn-post');


    // --- Core Initialization ---
    initKonva(DEFAULT_WIDTH, DEFAULT_HEIGHT);
    setupEventListeners();

    // =========================================================
    // 2. 🎨 Event Listeners Setup
    // =========================================================

    function setupEventListeners() {

        setupSidebarTabs('.sidebar-tabs', '.left-sidebar .tab-content');

        document.querySelectorAll('.sidebar-tabs-right .right-tab-button').forEach(button => {
            button.addEventListener('click', handleRightTabClick);
        });

        // --- Right Sidebar Controls ---
        if (opacitySlider) {
            opacitySlider.addEventListener('input', function() {
                if (selectedShape) {
                    selectedShape.opacity(parseFloat(this.value) / 100);
                    setupSidebar(selectedShape);
                    layer.batchDraw();
                }
            });
            opacitySlider.addEventListener('change', saveState);
        }

        if (colorPicker) colorPicker.addEventListener('change', function() {
            if (selectedShape && selectedShape.getClassName() === 'Text') {
                selectedShape.fill(this.value);
                const hexInput = document.getElementById('color-hex-input');
                if (hexInput) hexInput.value = this.value.toUpperCase();
                layer.batchDraw();
                saveState();
            }
        });
        if (colorHexInput) colorHexInput.addEventListener('change', function() {
            if (selectedShape && selectedShape.getClassName() === 'Text') {
                selectedShape.fill(this.value);
                const colorP = document.getElementById('color-picker');
                if (colorP) colorP.value = this.value.toUpperCase();
                layer.batchDraw();
                saveState();
            }
        });
        if (fontFamilySelect) {
            fontFamilySelect.addEventListener('change', function() {
                if (selectedShape && selectedShape.getClassName() === 'Text') {
                    selectedShape.fontFamily(this.value);
                    layer.batchDraw();
                    saveState();
                }
            });
        }

        // Shadow Toggle Logic - working
        if (shadowToggle) {
            shadowToggle.addEventListener('change', function() {
                if (selectedShape) {
                    if (this.checked) {
                        selectedShape.setAttr('shadowEnabled', true); // Use custom attribute for history
                        selectedShape.shadowColor('black');
                        selectedShape.shadowBlur(10);
                        selectedShape.shadowOffset({ x: 5, y: 5 });
                        selectedShape.shadowOpacity(0.5);
                    } else {
                        selectedShape.setAttr('shadowEnabled', false); // Use custom attribute for history
                        selectedShape.shadowColor(null);
                        selectedShape.shadowBlur(0);
                        selectedShape.shadowOffset({ x: 0, y: 0 });
                        selectedShape.shadowOpacity(0);
                    }
                    // Must call cache() on images for shadow to appear correctly
                    if (selectedShape.getClassName() === 'Image') selectedShape.cache();
                    layer.batchDraw();
                    saveState();
                } else {
                    this.checked = false;
                }
            });
        }

        const shadowColor = document.getElementById('shadow-color');
        if (shadowColor) shadowColor.addEventListener('input', function() {
            if (selectedShape) {
                selectedShape.shadowColor(this.value);
                layer.draw();
                saveState();
            }
        });
        const shadowBlur = document.getElementById('shadow-blur');
        if (shadowBlur) shadowBlur.addEventListener('input', function() {
            if (selectedShape) {
                selectedShape.shadowBlur(parseFloat(this.value));
                layer.draw();
                saveState();
            }
        });
        const shadowOffsetX = document.getElementById('shadow-offset-x');
        if (shadowOffsetX) shadowOffsetX.addEventListener('input', function() {
            if (selectedShape) {
                selectedShape.shadowOffsetX(parseFloat(this.value));
                layer.draw();
                saveState();
            }
        });
        const shadowOffsetY = document.getElementById('shadow-offset-y');
        if (shadowOffsetY) shadowOffsetY.addEventListener('input', function() {
            if (selectedShape) {
                selectedShape.shadowOffsetY(parseFloat(this.value));
                layer.draw();
                saveState();
            }
        });

        // Animation Select Listener - working
        if (animationSelect) {
            animationSelect.addEventListener('change', function() {
                if (selectedShape) {
                    applyAnimation(selectedShape, this.value);
                    saveState();
                }
            });
        }

        // --- Floating Toolbar Logic ---
        const floatDelete = document.getElementById('float-delete');
        if (floatDelete) floatDelete.addEventListener('click', () => { deleteSelectedShape(); saveState(); });
        const floatDuplicate = document.getElementById('float-duplicate');
        if (floatDuplicate) floatDuplicate.addEventListener('click', () => { duplicateSelectedShape(); saveState(); });
        const floatBold = document.getElementById('float-bold');
        if (floatBold) floatBold.addEventListener('click', () => { toggleTextBold(); saveState(); });
        const floatItalic = document.getElementById('float-italic');
        if (floatItalic) floatItalic.addEventListener('click', () => { toggleTextItalic(); saveState(); });
        const floatSize = document.getElementById('float-size');
        if (floatSize) floatSize.addEventListener('click', () => { increaseFontSize(); saveState(); });
        const floatToFront = document.getElementById('float-to-front');
        if (floatToFront) floatToFront.addEventListener('click', () => {
            if (selectedShape) {
                selectedShape.moveToTop();
                layer.draw();
                saveState();
            }
        });
        const floatToBack = document.getElementById('float-to-back');
        if (floatToBack) floatToBack.addEventListener('click', () => {
            if (selectedShape) {
                selectedShape.moveToBottom();
                layer.draw();
                saveState();
            }
        });

        // --- Keyboard Listeners ---
        window.addEventListener('keydown', function(e) {
            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (selectedShape) {
                    deleteSelectedShape();
                    saveState();
                }
            }
        });

        // --- Content Adding ---
        document.querySelectorAll('#text .asset-card').forEach(card => {
            card.addEventListener('click', function() {
                const type = this.dataset.textType;
                let size = type === 'heading' ? 36 : 18;
                let text = type === 'heading' ? 'Click to Edit Headline' : 'Add supporting text here...';
                addTextToCanvas(text, size, '#FFFFFF');
                saveState();
            });
        });

        if (uploadBtn) uploadBtn.addEventListener('click', () => { mediaUploadInput.click(); });

        if (mediaUploadInput) mediaUploadInput.addEventListener('change', function(e) {
            if (e.target.files.length > 0 && e.target.files[0].type.match('image.*')) {
                const reader = new FileReader();
                reader.onload = function (event) {
                    const img = new Image();
                    img.crossOrigin = 'Anonymous';
                    img.onload = function() { loadAndSetupImage(img); saveState(); };
                    img.src = event.target.result;
                };
                reader.readAsDataURL(e.target.files[0]);
            }
        });

        // Templates
        document.querySelectorAll('.template-item').forEach(item => {
            item.addEventListener('click', function() {
                const templateId = this.dataset.templateId;
                if (templateId) {
                    loadTemplate(templateId);
                }
            });
        });

        // --- Audio Upload Logic ---
        if (audioUploadBtn) audioUploadBtn.addEventListener('click', () => { audioUploadInput.click(); });

        if (audioUploadInput) audioUploadInput.addEventListener('change', function(e) {
            if (e.target.files.length > 0 && e.target.files[0].type.match('audio.*')) {
                const url = URL.createObjectURL(e.target.files[0]);
                if (backgroundAudio) backgroundAudio.src = url;
                if (audioPlayerControls) audioPlayerControls.style.display = 'block';
            }
        });

        // --- Canvas Resizing & Controls ---
        if (presetSizeSelect) presetSizeSelect.addEventListener('change', function() {
            const selectedOption = this.options[this.selectedIndex];
            resizeCanvas(parseInt(selectedOption.dataset.w), parseInt(selectedOption.dataset.h));
        });

        if (document.getElementById('zoom-in')) document.getElementById('zoom-in').addEventListener('click', () => {
            if (stage.scaleX() < 2) stage.scale({ x: stage.scaleX() * 1.1, y: stage.scaleY() * 1.1 });
            if (stage) stage.batchDraw();
        });

        if (document.getElementById('zoom-out')) document.getElementById('zoom-out').addEventListener('click', () => {
            if (stage.scaleX() > 0.5) stage.scale({ x: stage.scaleX() * 0.9, y: stage.scaleY() * 0.9 });
            if (stage) stage.batchDraw();
        });

        // Undo/Redo Listeners - working
        if (undoBtn) undoBtn.addEventListener('click', () => loadState(true));
        if (redoBtn) redoBtn.addEventListener('click', () => loadState(false));

        // --- Export Listener ---
        if (exportBtn) exportBtn.addEventListener('click', exportCanvas);

        // --- Post Listener ---
        if (postBtn) postBtn.addEventListener('click', simulatePost);

        // --- Drag and Drop Setup ---
        if (container) {
            container.addEventListener('dragover', function (e) {
                e.preventDefault();
                if (mockup) mockup.style.boxShadow = '0 0 0 5px #05eafa, 0 10px 30px rgba(0, 0, 0, 0.5)';
            });

            container.addEventListener('dragleave', function (e) {
                if (mockup) mockup.style.boxShadow = '0 0 0 5px #000, 0 10px 30px rgba(0, 0, 0, 0.5)';
            });

            container.addEventListener('drop', handleDrop);
        }

    } // End of setupEventListeners

} // End of initEditor