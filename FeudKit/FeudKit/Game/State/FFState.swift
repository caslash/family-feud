//
//  FFState.swift
//  FeudKit
//
//  Created by Cameron Slash on 11/30/23.
//

import Foundation
import SlashKit

public class FFState: State<FFStateType> {
    internal override init(type: FFStateType) {
        super.init(type: type)
    }
    
    public override func updateState(timeElapsed: Float) { }
}
