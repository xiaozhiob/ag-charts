import type { MarkerPathMove } from './marker';
import { Marker } from './marker';

export class Diamond extends Marker {
    static readonly className = 'Diamond';

    private static readonly moves: MarkerPathMove[] = [
        { x: 0, y: -1, t: 'move' },
        { x: +1, y: +1 },
        { x: -1, y: +1 },
        { x: -1, y: -1 },
        { x: +1, y: -1 },
    ];

    override updatePath() {
        const s = this.size / 2;

        super.applyPath(s, Diamond.moves);
    }
}
