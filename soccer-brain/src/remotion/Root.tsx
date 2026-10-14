import React from 'react';
import {Composition, type CalculateMetadataFunction} from 'remotion';
import type {VideoProps} from '../shared/types';
import {QuizVideo} from './QuizVideo';
import sample from './sample-props.json';

const calculateMetadata: CalculateMetadataFunction<VideoProps> = ({props}) => ({
  durationInFrames: props.timeline.totalFrames,
  fps: props.fps,
  width: props.width,
  height: props.height,
});

export const RemotionRoot: React.FC = () => (
  <Composition
    id="SoccerBrain"
    component={QuizVideo}
    durationInFrames={(sample as VideoProps).timeline.totalFrames}
    fps={30}
    width={1080}
    height={1920}
    defaultProps={sample as VideoProps}
    calculateMetadata={calculateMetadata}
  />
);
