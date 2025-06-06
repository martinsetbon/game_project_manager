document.addEventListener('DOMContentLoaded', function() {
    const dayWidth = 60; // Assuming each day is 60px wide

    // Align initial position with the grid
    document.querySelectorAll('.feature-card').forEach(card => {
        let x = parseFloat(card.getAttribute('data-x')) || 0;
        x = Math.round(x / dayWidth) * dayWidth;
        card.style.transform = `translate(${x}px, 0px)`;
        card.setAttribute('data-x', x);
    });

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
    const features = document.querySelectorAll('.feature-card');
    const targetWidth = parseFloat(target.style.width);

    for (let feature of features) {
        if (feature !== target) {
            const featureX = parseFloat(feature.getAttribute('data-x'));
            const featureWidth = parseFloat(feature.style.width);

            // Check if the target's new position overlaps with any other feature
            if (newX < featureX + featureWidth && newX + targetWidth > featureX) {
                return true; // Overlapping
            }
        }
    }
    return false; // Not overlapping
} 