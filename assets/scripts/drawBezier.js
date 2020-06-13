window.lcl = {};
window.lcl.Bezier = require('./Bezier');
window.lcl.BezierData = require('./BezierData');
window.lcl.NodeEvents = require('./NodeEvents');
window.lcl.Events = require('./EventListener');
window.lcl.Ident = require('./Enum').Ident;
window.lcl.BezierCurveType = require('./Enum').BezierCurveType;

cc.Class({
    extends: cc.Component,
    // editor: {
    //     executeInEditMode: true,
    // },

    properties: {
        graphicsNode: cc.Node,
        box: cc.Node,
        point: cc.Prefab,//坐标点
        control: cc.Prefab,//控制点
        bezierColor: new cc.Color(255, 0, 0),// 贝塞尔曲线颜色
        lineColor: new cc.Color(0, 255, 255),//控制线段
        infoWindow: cc.Node,
        paper: cc.Node,
        msg: cc.Node,
        timeInfo: cc.Label,//实时运行时间
        deleteBtn: cc.Node,//删除按钮
        mouseLocation: cc.Label,//鼠标坐标

    },

    onLoad() {
        this.init();
        lcl.Events.on("setMouseLocation", this.setMouseLocation.bind(this));
        lcl.Events.on("showDeleteBtn", this.showDeleteBtn.bind(this));
        lcl.Events.on("hideDeleteBtn", this.hideDeleteBtn.bind(this));
    },

    // 初始化
    init() {
        // 提示框
        this.infoWindow.zIndex = 10;
        this.notice = this.infoWindow.getChildByName("notice").getComponent(cc.Label);
        this.fileInputBox = this.infoWindow.getChildByName("Input").getChildByName("fileEditBox").getComponent(cc.EditBox);
        // 控制器面板
        let controlPanel = this.node.getChildByName("controlPanel");
        this.moveBtn = controlPanel.getChildByName("moveBtn");
        this.smoothnessInputBox = controlPanel.getChildByName("smoothnessInput").getChildByName("EditBox").getComponent(cc.EditBox);
        this.runTimeInputBox = controlPanel.getChildByName("runTimeInput").getChildByName("EditBox").getComponent(cc.EditBox);

        this.resolutionWidthInputBox = controlPanel.getChildByName("resolution").getChildByName("width").getComponent(cc.EditBox);
        this.resolutionHeightInputBox = controlPanel.getChildByName("resolution").getChildByName("height").getComponent(cc.EditBox);

        // 初始化Graphics
        this.initGraphics();
        this.initNodeEvents();
        this.hideInfoWindow();
        this.addDeleteBtnEvents();
        this.initResolution();
        // 初始化贝塞尔曲线数据
        lcl.BezierData.init(this.point, this.control, this.node);
        lcl.BezierData.setBezierCurveRunTime(Number(this.runTimeInputBox.string));
        lcl.BezierData.saveBezierPath();
    },

    update(dt) {
        lcl.NodeEvents.setOperateStatus(!this.deleteBtn.active);
        this.drawBezierAll();
        if (this.isStartRun) {
            this.setCountTimeLabel(dt);
        }
    },

    // 初始化绘制区域
    initResolution(){
        this.resolution = lcl.BezierData.getResolution();
        this.resolutionWidthInputBox.string = this.resolution.width;
        this.resolutionHeightInputBox.string = this.resolution.height;
        this.setPaperSize();
    },
    // 初始化Graphics
    initGraphics() {
        this.ctx = this.graphicsNode.getComponent(cc.Graphics);
        this.ctx.lineWidth = 2;
    },

    
    initNodeEvents() {
        lcl.NodeEvents.addCanvasTouchEvents();
        // 
        this.box.ident = lcl.Ident.window;
        this.moveBtn.ident = lcl.Ident.window;
        this.moveBtn.parent.ident = lcl.Ident.window;
        lcl.NodeEvents.addDragEvents(this.box)
        // 可移动的窗体
        lcl.NodeEvents.addDragEvents(this.moveBtn, this.moveBtn.parent);
        this.addHideEvents(this.moveBtn.parent)
        // this.inputNode.ident = lcl.Ident.window;
    },

    // 绘制路线
    drawBezierAll() {
        this.ctx.clear();
        let bezierLists = lcl.BezierData.getBezierCurveLists();
        for (var i = 0, len = bezierLists.length; i < len; i++) {
            const curve = bezierLists[i];
            let n = Object.keys(curve).length;
            // 绘制二阶贝塞尔
            if (n == 3) {
                this.drawBezier(curve.start.position, curve.control.position, curve.end.position);
            }
            // 绘制三阶贝塞尔
            if (n == 4) {
                this.drawThirdOrderBezier(curve);
            }
        }
    },
    // 绘制贝塞尔曲线
    drawBezier(startPos, controlPos, endPos) {
        //画笔移动到起始点
        this.ctx.moveTo(startPos.x, startPos.y);
        //线条颜色
        this.ctx.strokeColor = this.bezierColor;
        //绘制贝塞尔曲线
        this.ctx.quadraticCurveTo(controlPos.x, controlPos.y, endPos.x, endPos.y);
        this.ctx.stroke();
        //画笔移动到起始点
        this.ctx.moveTo(endPos.x, endPos.y);
        this.ctx.strokeColor = this.lineColor;
        //绘制直线
        this.ctx.lineTo(controlPos.x, controlPos.y);
        this.ctx.stroke();
        //
    },

    // 绘制三阶贝塞尔曲线
    drawThirdOrderBezier(curve) {
        //绘制贝塞尔曲线
        this.ctx.moveTo(curve.start.x, curve.start.y);
        //线条颜色
        this.ctx.strokeColor = this.bezierColor;
        this.ctx.bezierCurveTo(curve.control1.x, curve.control1.y, curve.control2.x, curve.control2.y, curve.end.x, curve.end.y);
        this.ctx.stroke();
        //绘制辅助线1
        this.ctx.moveTo(curve.start.x, curve.start.y);
        this.ctx.strokeColor = this.lineColor;
        this.ctx.lineTo(curve.control1.x, curve.control1.y);
        this.ctx.stroke();
        //绘制辅助线2
        this.ctx.moveTo(curve.end.x, curve.end.y);
        this.ctx.lineTo(curve.control2.x, curve.control2.y);
        this.ctx.stroke();
    },

    addHideEvents(node) {
        node.on(cc.Node.EventType.MOUSE_MOVE, (event) => {
            this.hideMouseLocation()
        })
    },

    // 屏幕坐标转换到节点坐标
    convertToNodeSpace(event) {
        return this.node.convertToNodeSpaceAR(event.getLocation());
    },
    // ------------------------【删除节点】---------------------------
    addDeleteBtnEvents() {
        this.deleteBtn.on(cc.Node.EventType.MOUSE_DOWN, (event) => {
            event.stopPropagation();
            if (event.getButton() == cc.Event.EventMouse.BUTTON_LEFT) {
                if (lcl.BezierData.isLastCurve()) {
                    this.showMsg("不能删除最后一个曲线!!");
                    return;
                }
                this.hideDeleteBtn();
                lcl.BezierData.deletePoint();//删除坐标点
                // 重新保存下路径
                lcl.BezierData.saveBezierPath();//保存坐标点
            }
        })
    },

    // save按钮
    save() {
        if (this.fileInputBox.string == "") {
            this.setNoitce("文件名不能为空!");
            return
        }
        // if (!this.checkRunTimeInputBox()) {
        //     this.showMsg("运行时间只能填写数字！！！")
        //     return
        // }
        this.setNoitce('');
        this.computeBezierActions();
        this.saveBezierPathToJson(this.fileInputBox.string);
    },

    //保存为json数据
    saveBezierPathToJson(name) {
        if (cc.sys.isBrowser) {
            // let datas = JSON.stringify(this.bezierCurveData);
            let datas = JSON.stringify(lcl.BezierData.getBezierCurveData());

            var textFileAsBlob = new Blob([datas], { type: 'application/json' });
            var downloadLink = document.createElement("a");
            downloadLink.download = name;
            downloadLink.innerHTML = "Download File";
            if (window.webkitURL != null) {
                // Chrome允许点击链接
                //而无需实际将其添加到DOM中。
                downloadLink.href = window.webkitURL.createObjectURL(textFileAsBlob);
            }
            else {
                //在点击之前 Firefox要求将链接添加到DOM中
                downloadLink.href = window.URL.createObjectURL(textFileAsBlob);
                downloadLink.onclick = destroyClickedElement;
                downloadLink.style.display = "none";
                document.body.appendChild(downloadLink);
            }
            downloadLink.click();
        }
    },
    // 
    computeBezierActions() {
        let bezierCurveData = lcl.BezierData.getBezierCurveData();
        this.actionLists = [];
        // 创建动作队列
        for (var i = 0, len = bezierCurveData.points.length; i < len; i++) {
            const point = bezierCurveData.points[i];
            //计算当前路段需要的时间
            let time = point.length / bezierCurveData.length * bezierCurveData.time;
            point.time = time;
            // 创建动作
            let action = cc.moveTo(time, cc.v2(point.x, point.y));
            this.actionLists.push(action);
        }
    },

    // 开始播放移动动画
    playMoveAnimation() {
        // 设置初始位置
        // this.box.setPosition(this.bezierLists[0].start);
        // 计算动作队列
        this.computeBezierActions();
        // 开始计时
        this.startCountTime();
        console.time("time", this.actionLists)
        this.actionLists.push(cc.callFunc(() => {
            this.stopCountTime();
            console.timeEnd("time")

        }))
        if (this.actionLists.length > 1) {
            this.box.runAction(cc.sequence(this.actionLists));
        } else {
            this.box.runAction(...this.actionLists);
        }
    },
    // 校验运行时间的输入格式
    // checkRunTimeInputBox() {
    //     if (this.runTime.string == "" || isNaN(Number(this.runTime.string))) {
    //         return false
    //     }
    //     return true
    // },
    // 设置分辨率
    setResolution(str, event, ident) {
        console.log(str, event, ident);
        let num = Number(str);
        if (str == "" || isNaN(num)) {
            this.showMsg("分辨率只能填写数字！！！");
            event.string = this.resolution[ident];
            return
        }
        this.resolution[ident] = num;
        lcl.BezierData.setResolution(this.resolution.width, this.resolution.height);
        this.setPaperSize();
        lcl.BezierData.init(this.point, this.control, this.node);
    },
    setPaperSize(){
        this.paper.width = this.resolution.width;
        this.paper.height = this.resolution.height;
    },
    // 设置运行时间
    setRunTime(str) {
        let num = Number(str);
        if (str == "" || isNaN(num)) {
            this.showMsg("运行时间只能填写数字！！！");
            this.runTimeInputBox.string = this.prveRunTime || 2;
            return
        }
        this.prveRunTime = num;
        lcl.BezierData.setBezierCurveRunTime(num);
    },

    // 设置曲线平滑度
    setCurveSmoothness(str) {
        console.log(str);
        let num = Number(str);
        if (str == "" || isNaN(num)) {
            this.showMsg("曲线平滑度只能填写数字！！！");
            this.smoothnessInputBox.string = this.prvePointCount || 100;
            return
        }
        if (num < 0 || num > 1000) {
            this.showMsg("曲线平滑度取值范围在 0 - 1000！");
            this.smoothnessInputBox.string = this.prvePointCount || 100;
            return
        }
        this.prvePointCount = num;
        lcl.BezierData.setPointCount(num);
    },

    // 播放动画
    play() {
        // if (!this.checkRunTimeInputBox()) {
        //     this.showMsg("运行时间只能填写数字！！！")
        //     return
        // }
        lcl.BezierData.saveBezierPath();//保存坐标点
        this.playMoveAnimation()
    },


    // ------------------------【弹窗设置相关】---------------------------
    showInfoWindow() {
        this.infoWindow.active = true;
        this.setNoitce('');
    },
    hideInfoWindow() {
        this.infoWindow.active = false;
    },
    setNoitce(str) {
        this.notice.string = str;
    },
    showMsg(msg) {
        this.msg.active = true;
        this.msg.getComponent(cc.Label).string = msg
        setTimeout(() => {
            if (this.msg) {
                this.msg.active = false;
            }
        }, 1000);
    },
    // 开始计时
    startCountTime() {
        this.isStartRun = true;
        this.timeInfo.string = 0;
        this.currentRunTime = 0;
    },
    // 停止计时
    stopCountTime() {
        this.isStartRun = false;
    },
    setCountTimeLabel(dt) {
        this.currentRunTime = this.currentRunTime + dt;
        this.timeInfo.string = "run time: " + this.currentRunTime.toFixed(2) + "s";
    },

    // 显示删除按钮
    showDeleteBtn(pos) {
        this.deleteBtn.active = true;
        this.deleteBtn.setPosition(pos);
    },
    hideDeleteBtn() {
        this.deleteBtn.active = false;
    },
    //显示鼠标坐标
    setMouseLocation(pos) {
        this.mouseLocation.node.active = true
        this.mouseLocation.node.setPosition(pos);
        this.mouseLocation.string = `x:${pos.x.toFixed(0)} y:${pos.y.toFixed(0)}`;
    },
    //隐藏
    hideMouseLocation() {
        this.mouseLocation.node.active = false
    },

    // 曲线类型选择
    setCurveType(event) {
        console.log(event);
        lcl.BezierData.setBezierCurveType(event.node._name)
    }
});
