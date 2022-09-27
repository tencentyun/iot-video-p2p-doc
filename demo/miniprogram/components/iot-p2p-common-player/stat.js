import { PlayerStateEnum, P2PStateEnum, StreamStateEnum } from './common';

// 启播步骤
export const PlayStepEnum = {
  CreatePlayer: 'StepCreatePlayer',
  InitModule: 'StepInitModule',
  StartP2PService: 'StepStartP2PService',
  ConnectLocalServer: 'StepConnectLocalServer',
  WaitStream: 'StepWaitStream',
  CheckStream: 'StepCheckStream',
  StartStream: 'StepStartStream',
  WaitHeader: 'StepWaitHeader',
  WaitData: 'StepWaitData',
  WaitIDR: 'StepWaitIDR',
  AutoReconnect: 'StepAutoReconnect', // 没正常播放，liveplayer自动重连，2103
  FinalStop: 'StepFinalStop', // 多次重连抢救无效，-2301
};

const state2StepConfig = {
  // player
  [PlayerStateEnum.PlayerReady]: {
    step: PlayStepEnum.CreatePlayer,
    fromState: PlayerStateEnum.PlayerPreparing,
    toState: PlayerStateEnum.PlayerReady,
  },
  [PlayerStateEnum.PlayerError]: {
    step: PlayStepEnum.CreatePlayer,
    fromState: PlayerStateEnum.PlayerPreparing,
    toState: PlayerStateEnum.PlayerError,
    isResult: true,
  },

  // p2p
  [P2PStateEnum.P2PInited]: {
    step: PlayStepEnum.InitModule,
    fromState: P2PStateEnum.P2PIniting,
    toState: P2PStateEnum.P2PInited,
  },
  [P2PStateEnum.P2PInitError]: {
    step: PlayStepEnum.InitModule,
    fromState: P2PStateEnum.P2PIniting,
    toState: P2PStateEnum.P2PInitError,
    isResult: true,
  },
  [P2PStateEnum.ServiceStarted]: {
    step: PlayStepEnum.StartP2PService,
    fromState: P2PStateEnum.ServicePreparing,
    toState: P2PStateEnum.ServiceStarted,
  },
  [P2PStateEnum.ServiceStartError]: {
    step: PlayStepEnum.StartP2PService,
    fromState: P2PStateEnum.ServicePreparing,
    toState: P2PStateEnum.ServiceStartError,
    isResult: true,
  },

  // stream
  [StreamStateEnum.StreamReceivePull]: {
    step: PlayStepEnum.ConnectLocalServer,
    fromState: StreamStateEnum.StreamWaitPull,
    toState: StreamStateEnum.StreamReceivePull,
  },
  [StreamStateEnum.StreamLocalServerError]: {
    step: PlayStepEnum.ConnectLocalServer,
    fromState: StreamStateEnum.StreamWaitPull,
    toState: StreamStateEnum.StreamLocalServerError,
  },
  [StreamStateEnum.StreamCheckSuccess]: {
    step: PlayStepEnum.CheckStream,
    fromState: StreamStateEnum.StreamChecking,
    toState: StreamStateEnum.StreamCheckSuccess,
  },
  [StreamStateEnum.StreamCheckError]: {
    step: PlayStepEnum.CheckStream,
    fromState: StreamStateEnum.StreamChecking,
    toState: StreamStateEnum.StreamCheckError,
    isResult: true,
  },
  [StreamStateEnum.StreamStarted]: {
    step: PlayStepEnum.StartStream,
    fromState: StreamStateEnum.StreamPreparing,
    toState: StreamStateEnum.StreamStarted,
  },
  [StreamStateEnum.StreamStartError]: {
    step: PlayStepEnum.StartStream,
    fromState: StreamStateEnum.StreamPreparing,
    toState: StreamStateEnum.StreamStartError,
    isResult: true,
  },
  [StreamStateEnum.StreamHeaderParsed]: {
    step: PlayStepEnum.WaitHeader,
    fromState: StreamStateEnum.StreamStarted,
    toState: StreamStateEnum.StreamHeaderParsed,
  },
  [StreamStateEnum.StreamDataReceived]: {
    step: PlayStepEnum.WaitData,
    fromState: StreamStateEnum.StreamHeaderParsed,
    toState: StreamStateEnum.StreamDataReceived,
    isResult: true,
    isSuccess: true,
  },
  [StreamStateEnum.StreamError]: {
    step: PlayStepEnum.WaitStream,
    fromState: StreamStateEnum.StreamStarted,
    toState: StreamStateEnum.StreamError,
    isResult: true,
  },
};

export class PlayStat {
  innerId;
  onPlayStepsChange;
  onPlayResultChange;
  onIdrResultChange;

  playResultParams;
  idrResultParams;

  constructor({ innerId, onPlayStepsChange, onPlayResultChange, onIdrResultChange }) {
    this.innerId = innerId;
    this.onPlayStepsChange = onPlayStepsChange;
    this.onPlayResultChange = onPlayResultChange;
    this.onIdrResultChange = onIdrResultChange;
  }

  makeResultParams({ startAction, flvParams }) {
    console.log(`[${this.innerId}][stat]`, '==== start new play', startAction, flvParams);
    const now = Date.now();
    this.playResultParams = {
      startAction,
      flvParams,
      startTimestamp: now,
      lastTimestamp: now,
      playTimestamps: {},
      steps: [],
      result: null,
    };
    this.idrResultParams = null;
  }

  addStateTimestamp(state, { onlyOnce } = {}) {
    if (!state || !this.playResultParams || this.playResultParams.result) {
      return;
    }
    if (onlyOnce && this.playResultParams.playTimestamps[state]) {
      return;
    }
    this.playResultParams.playTimestamps[state] = Date.now();
    const stepCfg = state2StepConfig[state];
    if (stepCfg) {
      this.addStep(stepCfg.step, stepCfg);
    }
  }

  addStep(step, { fromState, toState, isResult, isSuccess } = {}) {
    if (!step || !this.playResultParams || this.playResultParams.result) {
      return;
    }
    const now = Date.now();
    const { playTimestamps } = this.playResultParams;
    let fromTime = 0;
    let toTime = 0;
    if (fromState) {
      if (!playTimestamps[fromState]) {
        console.warn(`[${this.innerId}][stat]`, 'addStep', step, 'but no fromState', fromState);
        return;
      }
      fromTime = playTimestamps[fromState];
    } else {
      fromTime = this.playResultParams.lastTimestamp;
    }
    if (toState) {
      if (!playTimestamps[toState]) {
        console.warn(`[${this.innerId}][stat]`, 'addStep', step, 'but no toState', toState);
        return;
      }
      toTime = playTimestamps[toState];
    } else {
      toTime = now;
    }

    const timeCost = toTime - fromTime;
    console.log(`[${this.innerId}][stat]`, 'addStep', step, timeCost, fromState ? `${fromState} -> ${toState || 'now'}` : '');
    this.playResultParams.lastTimestamp = now;
    this.playResultParams.steps.push({
      step,
      timeCost,
    });

    if (isResult) {
      this.playResultParams.result = toState;
      const { startAction, startTimestamp, result } = this.playResultParams;
      const totalTimeCost = now - startTimestamp;
      console.log(`[${this.innerId}][stat]`, '==== play result', startAction, step, result, totalTimeCost, this.playResultParams);
      if (isSuccess) {
        this.idrResultParams = {
          hasReceivedIDR: false,
          playSuccTime: now,
        };
      }
      this.onPlayResultChange(this.playResultParams);
    } else {
      this.onPlayStepsChange(this.playResultParams);
    }
  }

  receiveIDR() {
    if (!this.idrResultParams || this.idrResultParams.hasReceivedIDR) {
      return;
    }
    const timeCost = Date.now() - this.idrResultParams.playSuccTime;
    this.idrResultParams.hasReceivedIDR = true;
    this.idrResultParams.timeCost = timeCost;
    this.onIdrResultChange(this.idrResultParams);
  }
}
