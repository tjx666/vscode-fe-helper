<template>
    <div>
        <div></div>
        <!--  111
        -->
        <!-- 1233
         -->
    </div>
</template>

<script>
// single line
console.log('remove comments!');/** multiple line comments */const a = 1;
let b = 2;// single line
console.log(a, b)
export default {};
</script>

<style lang="scss" scoped>
.app {
    content: '/* 123*/';
    // single line comment
    color: #eab;

    .box {
        // single line comment
        color: /** multiple line comments */ red;
    }
}
// single line comment

.test {
    color: /** multiple line comments */ red;
}

/** multiple line comments */
</style>
