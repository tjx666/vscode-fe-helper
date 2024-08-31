import type { ButtonProps } from 'antd';

import { Button } from 'antd';
import { xyz } from 'color';

let var1 = 123;

console.log(a);

function Comp() {
    return (
        <div>
            Comp xyz
            <Button>Button</Button>
        </div>
    );
}

console.log(var1);

type TT = ButtonProps['type'];

console.log(Comp);
export default Comp;

interface Person {
    name: string;
    age: number;
}

const person: Person = {
    name: 'John',
    age: 30,
};

console.log(xyz);
