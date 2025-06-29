document.addEventListener('DOMContentLoaded', function() {
    const dayWidth = 60; // Assuming each day is 60px wide

    // Align initial position with the grid
    document.querySelectorAll('.feature-card').forEach(card => {
        let x = parseFloat(card.getAttribute('data-x')) || 0;
        x = Math.round(x / dayWidth) * dayWidth;
        card.style.transform = `translate(${x}px, 0px)`;
        card.setAttribute('data-x', x);
    });

    // Add warning icon if overlapping
    function updateOverlapWarnings() {
        document.querySelectorAll('.feature-card').forEach(card => {
            // Remove existing warning icon
            const existing = card.querySelector('.overlap-warning');
            if (existing) existing.remove();
            // Remove any global popup for this card
            const globalPopup = document.querySelector('.overlap-popup[data-feature-id="' + card.dataset.id + '"]');
            if (globalPopup) globalPopup.remove();
            // Get the current left position from transform if present
            let x = 0;
            const transform = card.style.transform;
            if (transform && transform.startsWith('translate(')) {
                const match = transform.match(/translate\(([-\d.]+)px/);
                if (match) x = parseFloat(match[1]);
            } else {
                x = parseFloat(card.getAttribute('data-x')) || 0;
            }
            // Check for overlap
            if (isOverlapping(card, x)) {
                const icon = document.createElement('span');
                icon.className = 'overlap-warning';
                icon.innerHTML = '❗';
                icon.title = 'Feature overlaps with another feature';
                icon.style.color = 'red';
                icon.style.position = 'absolute';
                icon.style.right = '4px';
                icon.style.top = '4px';
                icon.style.cursor = 'pointer';
                icon.addEventListener('click', function(e) {
                    e.stopPropagation();
                    showOverlapPopup(card);
                });
                card.appendChild(icon);
            }
        });
    }

    function showOverlapPopup(card) {
        // Remove any existing global popup for this card
        const existing = document.querySelector('.overlap-popup[data-feature-id="' + card.dataset.id + '"]');
        if (existing) existing.remove();
        // Create popup
        const popup = document.createElement('div');
        popup.className = 'overlap-popup';
        popup.setAttribute('data-feature-id', card.dataset.id);
        popup.innerHTML = `
          <div style="background: #fff3f3; border: 1px solid #f5c2c7; color: #842029; padding: 10px; border-radius: 4px; min-width: 220px; box-shadow: 0 2px 8px rgba(0,0,0,0.15);">
            <div><strong>Warning</strong></div>
            <div>Warning, your features start and end date are overlapping</div>
            <button class="close-overlap-popup" style="margin-top: 8px; float: right;">OK</button>
          </div>
        `;
        document.body.appendChild(popup);
        // Position the popup near the card
        const rect = card.getBoundingClientRect();
        popup.style.position = 'absolute';
        popup.style.zIndex = 9999;
        popup.style.left = (window.scrollX + rect.right + 10) + 'px';
        popup.style.top = (window.scrollY + rect.top) + 'px';
        popup.querySelector('.close-overlap-popup').addEventListener('click', function() {
            popup.remove();
        });
    }

    interact('.feature-card')
        .draggable({
            axis: 'x',
            listeners: {
                move(event) {
                    const target = event.target;
                    let x = (parseFloat(target.getAttribute('data-x')) || 0) + event.dx;
                    // Move fluidly
                    target.style.transform = `translate(${x}px, 0px)`;
                    target.setAttribute('data-x', x);
                    updateOverlapWarnings(); // Update warnings live while dragging
                },
                end(event) {
                    const target = event.target;
                    // Snap to the nearest day on drag end
                    let x = parseFloat(target.getAttribute('data-x')) || 0;
                    x = Math.round(x / dayWidth) * dayWidth;
                    target.style.transform = `translate(${x}px, 0px)`;
                    target.setAttribute('data-x', x);

                    const startDate = new Date(target.getAttribute('data-start-date'));
                    const newStartDate = new Date(startDate.getTime() + (x / dayWidth) * 24 * 60 * 60 * 1000);
                    const duration = Math.round(parseFloat(target.style.width) / dayWidth);

                    updateFeature(target.dataset.id, {
                        start_date: newStartDate.toISOString().split('T')[0],
                        duration: duration
                    }, target);
                    updateOverlapWarnings();
                }
            }
        })
        .resizable({
            edges: { left: true, right: true },
            listeners: {
                move(event) {
                    const target = event.target;
                    let x = (parseFloat(target.getAttribute('data-x')) || 0);

                    // Snap width to the nearest day increment
                    const newWidth = Math.round(event.rect.width / dayWidth) * dayWidth;
                    target.style.width = `${newWidth}px`;

                    // Adjust x position when resizing from the left and snap
                    if (event.edges.left) {
                        x += Math.round(event.deltaRect.left / dayWidth) * dayWidth;
                    }

                    target.style.transform = `translate(${x}px, 0px)`;
                    target.setAttribute('data-x', x);
                    updateOverlapWarnings(); // Update warnings live while resizing
                },
                end(event) {
                    const target = event.target;
                    const startDate = new Date(target.getAttribute('data-start-date'));
                    const newStartDate = new Date(startDate.getTime() + (parseFloat(target.getAttribute('data-x')) / dayWidth) * 24 * 60 * 60 * 1000);
                    const duration = Math.round(parseFloat(target.style.width) / dayWidth);

                    updateFeature(target.dataset.id, {
                        start_date: newStartDate.toISOString().split('T')[0],
                        duration: duration
                    }, target);
                    updateOverlapWarnings();
                }
            },
            modifiers: [
                interact.modifiers.snap({
                    targets: [
                        interact.snappers.grid({ x: dayWidth, y: 1 })
                    ],
                    range: Infinity,
                    relativePoints: [{ x: 0, y: 0 }]
                })
            ]
        });

    // Initial warning check
    updateOverlapWarnings();
});

function updateFeature(id, data, target) {
    const projectId = target.getAttribute('data-project-id');
    fetch(`/projects/${projectId}/project_features/${id}/update_dates`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]').getAttribute('content')
        },
        body: JSON.stringify({ project_feature: data })
    })
    .then(response => response.json())
    .then(data => {
        console.log('Feature updated:', data);
    })
    .catch(error => {
        console.error('Error updating feature:', error);
    });
}

function isOverlapping(target, newX) {
    const features = Array.from(document.querySelectorAll('.feature-card'));
    const targetWidth = parseFloat(target.style.width);
    const targetRow = target.closest('.contributor-row');
    for (let feature of features) {
        if (feature !== target && feature.closest('.contributor-row') === targetRow) {
            // Get the current left position of the other feature
            let featureX = 0;
            const transform = feature.style.transform;
            if (transform && transform.startsWith('translate(')) {
                const match = transform.match(/translate\(([-\d.]+)px/);
                if (match) featureX = parseFloat(match[1]);
            } else {
                featureX = parseFloat(feature.getAttribute('data-x')) || 0;
            }
            const featureWidth = parseFloat(feature.style.width);
            // Check if the target's new position overlaps with any other feature
            if (newX < featureX + featureWidth && newX + targetWidth > featureX) {
                return true; // Overlapping
            }
        }
    }
    return false; // Not overlapping
} 